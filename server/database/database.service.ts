import initSqlJs, { Database } from 'sql.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

class DatabaseService {
  private db: Database | null = null
  private dbPath = join(process.cwd(), 'webinars.db')

  async init() {
    const SQL = await initSqlJs()
    
    // Загрузить существующую БД или создать новую
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
      await this.initDatabase()
    }
  }

  private async initDatabase() {
    const schema = readFileSync(join(process.cwd(), 'server', 'database', 'schema.sql'), 'utf-8')
    this.db!.exec(schema)
    
    // Предзаполнение тегов
    const seedTags = readFileSync(join(process.cwd(), 'server', 'database', 'seed-tags.sql'), 'utf-8')
    this.db!.exec(seedTags)
    
    this.save()
  }

  private save() {
    if (this.db) {
      const data = this.db.export()
      writeFileSync(this.dbPath, data)
    }
  }

  getDatabase() {
    return this.db
  }

  // Получить статистику
  getStats() {
    const db = this.db!
    
    // Всего вебинаров
    const webinarsResult = db.exec('SELECT COUNT(*) as count FROM Вебинары')
    const totalWebinars = webinarsResult[0]?.values[0]?.[0] as number || 0
    
    // Среднее кол-во участников (которые были хотя бы 1 минуту)
    // Присутствие_относительно_длительности хранится как текст "HH:MM:SS"
    // Преобразуем в минуты: часы*60 + минуты + секунды/60
    const avgParticipantsResult = db.exec(`
      SELECT AVG(participant_count) as avg
      FROM (
        SELECT COUNT(DISTINCT ID_участника) as participant_count
        FROM "Участники-Вебинары"
        WHERE (
          CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
        GROUP BY ID_вебинара
      )
    `)
    const avgParticipants = avgParticipantsResult[0]?.values[0]?.[0] as number || 0
    
    // Средняя конверсия (процент посетивших вебинар от всех зарегистрированных)
    // Посетивший = тот, кто был хотя бы 1 минуту
    const conversionResult = db.exec(`
      SELECT 
        COUNT(CASE WHEN (
          CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1 THEN 1 END) * 100.0 / 
        NULLIF(COUNT(*), 0) as conversion
      FROM "Участники-Вебинары"
    `)
    const avgConversion = conversionResult[0]?.values[0]?.[0] as number || 0
    
    // Среднее удержание (средний процент присутствия от общей длительности)
    // Считаем только по тем, кто был хотя бы 1 минуту
    // Присутствие_от_общей_длительности хранится как текст "48,78%"
    // Преобразуем: убираем %, заменяем запятую на точку
    const retentionResult = db.exec(`
      SELECT AVG(
        CAST(REPLACE(REPLACE(Присутствие_от_общей_длительности, '%', ''), ',', '.') AS REAL)
      ) as avg
      FROM "Участники-Вебинары"
      WHERE (
        CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
        CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
        CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
      ) >= 1
      AND Присутствие_от_общей_длительности IS NOT NULL
    `)
    const avgRetention = retentionResult[0]?.values[0]?.[0] as number || 0
    
    // Всего уникальных пользователей (участников)
    const usersResult = db.exec('SELECT COUNT(DISTINCT ID_участника) as count FROM Участники')
    const totalUsers = usersResult[0]?.values[0]?.[0] as number || 0
    
    // Наиболее популярный продукт (тег с наибольшим средним удержанием)
    const popularProductResult = db.exec(`
      SELECT t.Название_тега as tag, 
             AVG(
               CAST(REPLACE(REPLACE(uw.Присутствие_от_общей_длительности, '%', ''), ',', '.') AS REAL)
             ) as avg_retention
      FROM "Вебинары-Теги" wt
      INNER JOIN Тег t ON wt.ID_тега = t.ID_тега
      INNER JOIN "Участники-Вебинары" uw ON wt.ID_мероприятия = uw.ID_вебинара
      WHERE t.Название_тега NOT IN ('для клиентов', 'для партнёров')
        AND uw.Присутствие_от_общей_длительности IS NOT NULL
        AND (
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
      GROUP BY t.Название_тега
      ORDER BY avg_retention DESC
      LIMIT 1
    `)
    const popularProduct = popularProductResult[0]?.values[0]?.[0] as string || 'Нет данных'
    
    return {
      totalWebinars,
      avgParticipants: Math.round(avgParticipants),
      avgConversion: Math.round(avgConversion),
      avgRetention: Math.round(avgRetention),
      totalUsers,
      popularProduct
    }
  }

  // Получить участников с агрегированными данными
  getParticipants() {
    const query = `
      SELECT 
        u.Имя || ' ' || u.Фамилия as name,
        u.ИНН_компании as inn,
        e.Email as email,
        COUNT(DISTINCT uw.ID_вебинара) as webinarCount,
        COALESCE(SUM(uw.Кол_во_сообщений), 0) as messagesCount,
        COALESCE(SUM(uw.Кол_во_вопросов), 0) as questionsCount
      FROM Участники u
      INNER JOIN Email e ON u.ID_участника = e.ID_участника
      LEFT JOIN "Участники-Вебинары" uw ON u.ID_участника = uw.ID_участника
      GROUP BY u.ID_участника, u.ИНН_компании, e.Email
      ORDER BY webinarCount DESC
      LIMIT 50
    `
    return this.execQuery(query)
  }

  // Получить уникальных пользователей с их продуктами
  getUniqueUsers() {
    const query = `
      SELECT 
        c.ИНН_компании as inn,
        c.Название as companyName,
        u.Номер_телефона as phone,
        GROUP_CONCAT(DISTINCT e.Email) as emails,
        GROUP_CONCAT(DISTINCT CASE 
          WHEN t.Название_тега NOT IN ('для клиентов', 'для партнёров') 
          THEN t.Название_тега 
        END) as products
      FROM Участники u
      INNER JOIN Компания c ON u.ID_компании = c.ID_компании
      INNER JOIN Email e ON u.ID_участника = e.ID_участника
      LEFT JOIN "Участники-Вебинары" uw ON u.ID_участника = uw.ID_участника
      LEFT JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
      LEFT JOIN "Вебинары-Теги" wt ON w.ID_вебинара = wt.ID_мероприятия
      LEFT JOIN Тег t ON wt.ID_тега = t.ID_тега
      WHERE (
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
      ) >= 1
      GROUP BY u.ID_участника, c.ИНН_компании, c.Название, u.Номер_телефона
      ORDER BY c.ИНН_компании
    `
    return this.execQuery(query)
  }

  // Получить детальную информацию о вебинаре
  getWebinarDetail(webinarId: number) {
    // Получаем базовую информацию о вебинаре
    const webinarQuery = `
      SELECT 
        w.ID_вебинара as id,
        w.Название as name,
        w.Дата as date
      FROM Вебинары w
      WHERE w.ID_вебинара = ?
    `
    const webinarResult = this.db!.exec(webinarQuery, [webinarId])
    if (webinarResult.length === 0) return null
    
    const webinar: any = {}
    webinarResult[0].columns.forEach((col, i) => {
      webinar[col] = webinarResult[0].values[0][i]
    })
    
    // Получаем теги
    const tagsQuery = `
      SELECT GROUP_CONCAT(t.Название_тега, ', ') as tags
      FROM "Вебинары-Теги" wt
      INNER JOIN Тег t ON wt.ID_тега = t.ID_тега
      WHERE wt.ID_мероприятия = ?
    `
    const tagsResult = this.db!.exec(tagsQuery, [webinarId])
    webinar.tags = tagsResult[0]?.values[0]?.[0] || null
    
    // Получаем количество участников (>= 1 минуты)
    const participantQuery = `
      SELECT COUNT(DISTINCT ID_участника) as count
      FROM "Участники-Вебинары"
      WHERE ID_вебинара = ?
        AND (
          CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
    `
    const participantResult = this.db!.exec(participantQuery, [webinarId])
    webinar.participantCount = participantResult[0]?.values[0]?.[0] || 0
    
    // Получаем среднее удержание
    const retentionQuery = `
      SELECT ROUND(AVG(CAST(REPLACE(REPLACE(Присутствие_от_общей_длительности, '%', ''), ',', '.') AS REAL))) as avg
      FROM "Участники-Вебинары"
      WHERE ID_вебинара = ?
        AND (
          CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
    `
    const retentionResult = this.db!.exec(retentionQuery, [webinarId])
    webinar.avgRetention = retentionResult[0]?.values[0]?.[0] || 0
    
    // Получаем конверсию
    const conversionQuery = `
      SELECT 
        SUM(CASE WHEN (
          CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as conversion
      FROM "Участники-Вебинары"
      WHERE ID_вебинара = ?
    `
    const conversionResult = this.db!.exec(conversionQuery, [webinarId])
    webinar.conversion = Math.round((conversionResult[0]?.values[0]?.[0] as number) || 0)
    
    return webinar
  }

  // Получить список пользователей конкретного вебинара
  getWebinarUsers(webinarId: number) {
    const query = `
      SELECT 
        c.ИНН_компании as inn,
        uw.Имя_в_чате as chatName,
        GROUP_CONCAT(DISTINCT e.Email) as emails,
        COALESCE(uw.Присутствие_от_общей_длительности, 0) as retention,
        (SELECT GROUP_CONCAT(t2.Название_тега, ', ')
         FROM "Вебинары-Теги" wt2
         INNER JOIN Тег t2 ON wt2.ID_тега = t2.ID_тега
         WHERE wt2.ID_мероприятия = ?
           AND t2.Название_тега NOT IN ('для клиентов', 'для партнёров')
        ) as products
      FROM "Участники-Вебинары" uw
      INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
      INNER JOIN Компания c ON u.ID_компании = c.ID_компании
      INNER JOIN Email e ON u.ID_участника = e.ID_участника
      WHERE uw.ID_вебинара = ?
        AND (
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
      GROUP BY u.ID_участника, c.ИНН_компании, uw.Имя_в_чате, uw.Присутствие_от_общей_длительности
      ORDER BY retention DESC
    `
    return this.execQuery(query, [webinarId, webinarId])
  }

  // Получить UTM статистику для конкретного вебинара
  getWebinarUtmStats(webinarId: number) {
    const query = `
      SELECT 
        COALESCE(utm_source, '') as utm_source,
        COALESCE(utm_medium, '') as utm_medium,
        COALESCE(utm_campaign, '') as utm_campaign,
        COALESCE(utm_content, '') as utm_content,
        COUNT(*) as count
      FROM "Участники-Вебинары"
      WHERE ID_вебинара = ?
        AND (
          CAST(SUBSTR(Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
      GROUP BY utm_source, utm_medium, utm_campaign, utm_content
      ORDER BY count DESC
    `
    return this.execQuery(query, [webinarId])
  }

  // Получить детальную информацию об участнике по ИНН
  getParticipantDetail(email: string) {
    const query = `
      SELECT 
        e.Email as email,
        c.ИНН_компании as inn,
        c.Название as companyName,
        u.Номер_телефона as phone,
        u.Имя as firstName,
        u.Фамилия as lastName,
        (SELECT uw.Должность 
         FROM "Участники-Вебинары" uw 
         WHERE uw.ID_участника = e.ID_участника 
         AND uw.Должность IS NOT NULL 
         LIMIT 1) as position,
        (SELECT COUNT(*) FROM "Участники-Вебинары" uw2 
         WHERE uw2.ID_участника = e.ID_участника) as totalWebinars,
        (SELECT MIN(w.Дата) 
         FROM "Участники-Вебинары" uw3 
         INNER JOIN Вебинары w ON uw3.ID_вебинара = w.ID_вебинара 
         WHERE uw3.ID_участника = e.ID_участника) as firstWebinarDate
      FROM Email e
      INNER JOIN Участники u ON e.ID_участника = u.ID_участника
      INNER JOIN Компания c ON u.ID_компании = c.ID_компании
      WHERE e.Email = ?
      LIMIT 1
    `
    const result = this.execQuery(query, [email])
    if (result.length === 0) return null
    
    const participant = result[0]
    // Участник новый, если посетил только 1 вебинар
    participant.isNew = participant.totalWebinars === 1
    
    return participant
  }

  // Получить список вебинаров, которые посетил участник
  getParticipantWebinars(email: string) {
    const query = `
      SELECT 
        w.ID_вебинара as webinarId,
        w.Название as webinarName,
        w.Дата as webinarDate,
        (
          SELECT GROUP_CONCAT(DISTINCT Название_тега)
          FROM "Вебинары-Теги" wt2
          INNER JOIN Тег t2 ON wt2.ID_тега = t2.ID_тега
          WHERE wt2.ID_мероприятия = w.ID_вебинара
        ) as tags,
        uw.utm_source as utmSource,
        uw.utm_medium as utmMedium,
        uw.utm_campaign as utmCampaign,
        uw.utm_content as utmContent
      FROM "Участники-Вебинары" uw
      INNER JOIN Email e ON uw.ID_участника = e.ID_участника
      INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
      WHERE e.Email = ?
        AND (
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
      GROUP BY w.ID_вебинара, w.Название, w.Дата, uw.utm_source, uw.utm_medium, uw.utm_campaign, uw.utm_content
      ORDER BY w.Дата DESC
    `
    return this.execQuery(query, [email])
  }

  // Получить последние сообщения чата
  getMessages() {
    const query = `
      SELECT 
        uw.Имя_в_чате as chatName,
        e.Email as email,
        c.Время as time,
        c.Сообщение_чата as message,
        w.Название as webinarName
      FROM Чат c
      INNER JOIN Email e ON c.ID_email = e.ID_email
      INNER JOIN Вебинары w ON c.ID_вебинара = w.ID_вебинара
      LEFT JOIN "Участники-Вебинары" uw ON e.ID_участника = uw.ID_участника AND c.ID_вебинара = uw.ID_вебинара
      ORDER BY c.ID_сообщения DESC
      LIMIT 50
    `
    return this.execQuery(query)
  }

  // Получить вопросы
  getQuestions() {
    const query = `
      SELECT 
        e.Email as author,
        v.Вопрос as question,
        v.Статус_вопроса as status,
        v.Отвечающий as responder,
        w.Название as webinarName
      FROM Вопросы v
      INNER JOIN Email e ON v.ID_email = e.ID_email
      INNER JOIN Вебинары w ON v.ID_вебинара = w.ID_вебинара
      ORDER BY v.ID_вопроса DESC
      LIMIT 50
    `
    return this.execQuery(query)
  }

  // Получить все вебинары
  getWebinars() {
    const query = `
      SELECT 
        w.ID_вебинара as id,
        w.Название as name,
        w.Дата as date,
        GROUP_CONCAT(t.Название_тега, ', ') as tags
      FROM Вебинары w
      LEFT JOIN "Вебинары-Теги" wt ON w.ID_вебинара = wt.ID_мероприятия
      LEFT JOIN Тег t ON wt.ID_тега = t.ID_тега
      GROUP BY w.ID_вебинара
      ORDER BY w.Дата DESC
    `
    return this.execQuery(query)
  }

  // Вспомогательный метод для выполнения запросов
  private execQuery(query: string, params: any[] = []) {
    const result = this.db!.exec(query, params)
    if (result.length === 0) return []
    
    const columns = result[0].columns
    const values = result[0].values
    
    return values.map(row => {
      const obj: any = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj
    })
  }

  // Публичный метод для экспорта данных
  public execQueryForExport(query: string, params: any[] = []) {
    return this.execQuery(query, params)
  }

  // Создать вебинар
  createWebinar(name: string, date: string) {
    this.db!.run(`INSERT INTO Вебинары (Название, Дата) VALUES (?, ?)`, [name, date])
    const result = this.db!.exec('SELECT last_insert_rowid() as id')
    // Не сохраняем сразу, только в конце импорта
    return result[0].values[0][0] as number
  }

  // Обновить дату вебинара
  updateWebinarDate(webinarId: number, date: string) {
    this.db!.run(`UPDATE Вебинары SET Дата = ? WHERE ID_вебинара = ?`, [date, webinarId])
    // Не сохраняем сразу, только в конце импорта
  }

  // Добавить тег
  addTag(tagName: string) {
    this.db!.run(`INSERT OR IGNORE INTO Тег (Название_тега) VALUES (?)`, [tagName])
    
    const result = this.db!.exec('SELECT ID_тега FROM Тег WHERE Название_тега = ?', [tagName])
    // Не сохраняем сразу
    return result.length > 0 ? result[0].values[0][0] as number : null
  }

  // Связать вебинар с тегом
  linkWebinarTag(webinarId: number, tagId: number) {
    this.db!.run(`INSERT OR IGNORE INTO "Вебинары-Теги" (ID_мероприятия, ID_тега) VALUES (?, ?)`, [webinarId, tagId])
    // Не сохраняем сразу
  }

  // Получить или создать компанию по ИНН
  getOrCreateCompany(inn: string, companyName?: string) {
    // Ищем компанию по ИНН
    const result = this.db!.exec(`SELECT ID_компании FROM Компания WHERE ИНН_компании = ?`, [inn])

    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number
    }

    // Создаём новую компанию
    this.db!.run(`INSERT INTO Компания (ИНН_компании, Название) VALUES (?, ?)`, [
      inn, 
      companyName || null
    ])
    const idResult = this.db!.exec('SELECT last_insert_rowid() as id')
    return idResult[0].values[0][0] as number
  }

  // Получить или создать участника
  getOrCreateParticipant(firstName: string, lastName: string, inn: string, phone?: string, companyName?: string) {
    // Сначала получаем или создаём компанию
    const companyId = this.getOrCreateCompany(inn, companyName)
    
    // Ищем участника по компании, имени и фамилии
    const result = this.db!.exec(`
      SELECT ID_участника 
      FROM Участники 
      WHERE ID_компании = ? 
        AND (Имя = ? OR (Имя IS NULL AND ? IS NULL))
        AND (Фамилия = ? OR (Фамилия IS NULL AND ? IS NULL))
    `, [companyId, firstName || null, firstName || null, lastName || null, lastName || null])

    if (result.length > 0 && result[0].values.length > 0) {
      const participantId = result[0].values[0][0] as number
      
      // Обновляем телефон если он был передан
      if (phone) {
        this.db!.run(`UPDATE Участники SET Номер_телефона = ? WHERE ID_участника = ?`, [phone, participantId])
      }
      
      return participantId
    }

    // Создаём нового участника
    this.db!.run(`
      INSERT INTO Участники (ID_компании, Имя, Фамилия, Номер_телефона) 
      VALUES (?, ?, ?, ?)
    `, [
      companyId,
      firstName || null, 
      lastName || null,
      phone || null
    ])
    const idResult = this.db!.exec('SELECT last_insert_rowid() as id')
    return idResult[0].values[0][0] as number
  }

  // Получить или создать email
  getOrCreateEmail(email: string, participantId: number) {
    const result = this.db!.exec(`SELECT ID_email FROM Email WHERE Email = ?`, [email || null])

    if (result.length === 0 || result[0].values.length === 0) {
      this.db!.run(`INSERT INTO Email (Email, ID_участника) VALUES (?, ?)`, [
        email || null, 
        participantId
      ])
      const idResult = this.db!.exec('SELECT last_insert_rowid() as id')
      // Не сохраняем сразу
      return idResult[0].values[0][0] as number
    }

    return result[0].values[0][0] as number
  }

  // Добавить связь участник-вебинар
  addParticipantWebinar(participantId: number, webinarId: number, data: any) {
    // Заменяем все undefined на null
    const cleanData = {
      chatName: data.chatName || null,
      company: data.company || null,
      position: data.position || null,
      registrationStatus: data.registrationStatus || null,
      registrationDate: data.registrationDate || null,
      sources: data.sources || null,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      utmContent: data.utmContent || null,
      platform: data.platform || null,
      country: data.country || null,
      city: data.city || null,
      lastIP: data.lastIP || null,
      firstEntry: data.firstEntry || null,
      lastExit: data.lastExit || null,
      attendanceDuration: data.attendanceDuration || null,
      attendancePercent: data.attendancePercent || null,
      messagesCount: data.messagesCount || 0,
      messagesPercent: data.messagesPercent || null,
      questionsCount: data.questionsCount || 0,
      questionsPercent: data.questionsPercent || null,
      handsRaised: data.handsRaised || 0,
      emojiReactions: data.emojiReactions || 0
    }

    this.db!.run(`
      INSERT OR REPLACE INTO "Участники-Вебинары" (
        ID_участника, ID_вебинара, Имя_в_чате, Компания, Должность,
        Статус_регистрации, Дата_регистрации, Источники,
        utm_source, utm_medium, utm_campaign, utm_content,
        Платформа, Страна, Город, Последний_IP,
        Время_входа_первое, Время_выхода_последнее,
        Присутствие_относительно_длительности,
        Присутствие_от_общей_длительности,
        Кол_во_сообщений, Процент_от_общего_кол_ва_сообщений,
        Кол_во_вопросов, Процент_от_общего_кол_ва_вопросов,
        Количество_поднятых_рук, Количество_отправленных_эмодзи_реакций
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      participantId, webinarId,
      cleanData.chatName, cleanData.company, cleanData.position,
      cleanData.registrationStatus, cleanData.registrationDate, cleanData.sources,
      cleanData.utmSource, cleanData.utmMedium, cleanData.utmCampaign, cleanData.utmContent,
      cleanData.platform, cleanData.country, cleanData.city, cleanData.lastIP,
      cleanData.firstEntry, cleanData.lastExit,
      cleanData.attendanceDuration, cleanData.attendancePercent,
      cleanData.messagesCount, cleanData.messagesPercent,
      cleanData.questionsCount, cleanData.questionsPercent,
      cleanData.handsRaised, cleanData.emojiReactions
    ])
    // Не сохраняем сразу
  }

  // Добавить сообщение чата
  addChatMessage(webinarId: number, emailId: number, time: string, message: string) {
    this.db!.run(`INSERT INTO Чат (ID_вебинара, ID_email, Время, Сообщение_чата) VALUES (?, ?, ?, ?)`, [
      webinarId, 
      emailId, 
      time || null, 
      message || null
    ])
    // Не сохраняем сразу
  }

  // Добавить вопрос
  addQuestion(webinarId: number, emailId: number, data: any) {
    this.db!.run(`
      INSERT INTO Вопросы (
        ID_вебинара, ID_email, Автор_вопроса, Вопрос,
        Статус_вопроса, Отвечающий, Почта_отвечающего,
        Ответы_и_комментарии, Время_ответа
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      webinarId, 
      emailId, 
      data.author || null, 
      data.question || null,
      data.status || null, 
      data.responder || null, 
      data.responderEmail || null,
      data.answers || null, 
      data.answerTime || null
    ])
    // Не сохраняем сразу
  }

  // Удалить вебинар (откат при ошибке)
  deleteWebinar(webinarId: number) {
    // Удаляем в порядке зависимостей
    this.db!.run('DELETE FROM Чат WHERE ID_вебинара = ?', [webinarId])
    this.db!.run('DELETE FROM Вопросы WHERE ID_вебинара = ?', [webinarId])
    this.db!.run('DELETE FROM "Участники-Вебинары" WHERE ID_вебинара = ?', [webinarId])
    this.db!.run('DELETE FROM "Вебинары-Теги" WHERE ID_мероприятия = ?', [webinarId])
    this.db!.run('DELETE FROM Вебинары WHERE ID_вебинара = ?', [webinarId])
    
    // Удалить участников, которые больше не связаны ни с одним вебинаром
    this.cleanupOrphanedParticipants()
    
    this.save()
  }

  // Очистить участников без вебинаров
  private cleanupOrphanedParticipants() {
    // Найти ID участников, которые не связаны ни с одним вебинаром
    const orphanedParticipants = this.db!.exec(`
      SELECT ID_участника 
      FROM Участники 
      WHERE ID_участника NOT IN (
        SELECT DISTINCT ID_участника FROM "Участники-Вебинары"
      )
    `)

    if (orphanedParticipants.length > 0 && orphanedParticipants[0].values.length > 0) {
      const orphanedIds = orphanedParticipants[0].values.map(row => row[0])
      
      console.log(`🗑️ Удаление ${orphanedIds.length} участников без вебинаров`)
      
      // Удаляем email для этих участников
      for (const participantId of orphanedIds) {
        this.db!.run('DELETE FROM Email WHERE ID_участника = ?', [participantId])
      }
      
      // Удаляем самих участников
      for (const participantId of orphanedIds) {
        this.db!.run('DELETE FROM Участники WHERE ID_участника = ?', [participantId])
      }
    }

    // Найти ID компаний, которые не связаны ни с одним участником
    const orphanedCompanies = this.db!.exec(`
      SELECT ID_компании 
      FROM Компания 
      WHERE ID_компании NOT IN (
        SELECT DISTINCT ID_компании FROM Участники WHERE ID_компании IS NOT NULL
      )
    `)

    if (orphanedCompanies.length > 0 && orphanedCompanies[0].values.length > 0) {
      const orphanedCompanyIds = orphanedCompanies[0].values.map(row => row[0])
      
      console.log(`🗑️ Удаление ${orphanedCompanyIds.length} компаний без участников`)
      
      // Удаляем компании
      for (const companyId of orphanedCompanyIds) {
        this.db!.run('DELETE FROM Компания WHERE ID_компании = ?', [companyId])
      }
    }
  }

  // Сохранить БД (вызывается вручную после импорта)
  saveDatabase() {
    this.save()
  }

  // Получить все теги
  getAllTags() {
    const query = `SELECT ID_тега as id, Название_тега as name FROM Тег ORDER BY Название_тега`
    return this.execQuery(query)
  }

  // Получить данные для графика посещений по продуктам и времени
  getNewClientsTimeline() {
    // Оптимизированный запрос: возвращаем агрегированные данные
    // Для каждой комбинации месяц-продукт возвращаем количество участников и новых участников
    const query = `
      WITH ParticipantFirstVisit AS (
        SELECT 
          u.ID_участника,
          MIN(w.Дата) as firstVisitDate
        FROM "Участники-Вебинары" uw
        INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
        INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
        WHERE (
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
        GROUP BY u.ID_участника
      )
      SELECT 
        w.Дата as date,
        t.Название_тега as product,
        GROUP_CONCAT(DISTINCT u.ID_участника) as participantIds,
        (
          SELECT GROUP_CONCAT(DISTINCT u2.ID_участника)
          FROM "Участники-Вебинары" uw2
          INNER JOIN Участники u2 ON uw2.ID_участника = u2.ID_участника
          INNER JOIN ParticipantFirstVisit pf2 ON u2.ID_участника = pf2.ID_участника
          INNER JOIN "Вебинары-Теги" wt2 ON uw2.ID_вебинара = wt2.ID_мероприятия
          WHERE uw2.ID_вебинара = w.ID_вебинара
            AND wt2.ID_тега = t.ID_тега
            AND pf2.firstVisitDate = w.Дата
            AND (
              CAST(SUBSTR(uw2.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
              CAST(SUBSTR(uw2.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
              CAST(SUBSTR(uw2.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
            ) >= 1
        ) as newParticipantIds
      FROM Вебинары w
      INNER JOIN "Участники-Вебинары" uw ON w.ID_вебинара = uw.ID_вебинара
      INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
      INNER JOIN "Вебинары-Теги" wt ON w.ID_вебинара = wt.ID_мероприятия
      INNER JOIN Тег t ON wt.ID_тега = t.ID_тега
      LEFT JOIN ParticipantFirstVisit pf ON u.ID_участника = pf.ID_участника
      WHERE (
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
      ) >= 1
      AND t.Название_тега NOT IN ('для клиентов', 'для партнёров')
      GROUP BY w.ID_вебинара, w.Дата, t.Название_тега, t.ID_тега
      ORDER BY w.Дата ASC, t.Название_тега
    `
    return this.execQuery(query)
  }

  // Получить общее количество посещений по месяцам
  getTotalVisitorsTimeline() {
    const query = `
      SELECT 
        w.Дата as date,
        COUNT(uw.ID_участника) as totalVisitors
      FROM Вебинары w
      INNER JOIN "Участники-Вебинары" uw ON w.ID_вебинара = uw.ID_вебинара
      WHERE (
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
        CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
      ) >= 1
      GROUP BY w.ID_вебинара, w.Дата
      ORDER BY w.Дата ASC
    `
    return this.execQuery(query)
  }

  // Получить детали компании по ИНН
  getCompanyDetail(inn: string) {
    const query = `
      SELECT 
        c.ИНН_компании as inn,
        c.Название as companyName,
        (SELECT w.ID_вебинара
         FROM "Участники-Вебинары" uw 
         INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара 
         INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
         WHERE u.ID_компании = c.ID_компании
           AND (
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
           ) >= 1
         ORDER BY w.Дата ASC
         LIMIT 1) as firstWebinarId,
        (SELECT w.Название
         FROM "Участники-Вебинары" uw 
         INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара 
         INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
         WHERE u.ID_компании = c.ID_компании
           AND (
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
           ) >= 1
         ORDER BY w.Дата ASC
         LIMIT 1) as firstWebinar,
        ROUND((SELECT AVG(uw.Присутствие_от_общей_длительности)
         FROM "Участники-Вебинары" uw
         INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
         WHERE u.ID_компании = c.ID_компании
           AND (
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
           ) >= 1), 2) as avgRetention,
        (SELECT COUNT(DISTINCT uw.ID_вебинара)
         FROM "Участники-Вебинары" uw
         INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
         WHERE u.ID_компании = c.ID_компании
           AND (
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
             CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
           ) >= 1) as totalWebinars
      FROM Компания c
      WHERE c.ИНН_компании = ?
      LIMIT 1
    `
    const result = this.execQuery(query, [inn])
    if (result.length === 0) return null
    
    const company = result[0]
    
    // Компания новая, если была только на 1 вебинаре
    company.isNew = company.totalWebinars === 1
    
    // Получаем интересующие продукты (из тегов вебинаров, исключая служебные теги)
    const productsQuery = `
      SELECT DISTINCT t.Название_тега as product
      FROM "Участники-Вебинары" uw
      INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
      INNER JOIN "Вебинары-Теги" wt ON uw.ID_вебинара = wt.ID_мероприятия
      INNER JOIN Тег t ON wt.ID_тега = t.ID_тега
      WHERE u.ID_компании = (SELECT ID_компании FROM Компания WHERE ИНН_компании = ?)
        AND t.Название_тега NOT IN ('для клиентов', 'для партнёров')
        AND (
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
      ORDER BY t.Название_тега
    `
    const products = this.execQuery(productsQuery, [inn])
    company.interestedProducts = products.map((p: any) => p.product)
    
    return company
  }

  // Получить вебинары компании
  getCompanyWebinars(inn: string) {
    const query = `
      SELECT 
        w.ID_вебинара as webinarId,
        w.Название as webinarName,
        w.Дата as webinarDate,
        (
          SELECT GROUP_CONCAT(DISTINCT Название_тега)
          FROM "Вебинары-Теги" wt2
          INNER JOIN Тег t2 ON wt2.ID_тега = t2.ID_тега
          WHERE wt2.ID_мероприятия = w.ID_вебинара
        ) as tags,
        uw.utm_campaign as utmCampaign,
        uw.utm_medium as utmMedium
      FROM "Участники-Вебинары" uw
      INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
      INNER JOIN Компания c ON u.ID_компании = c.ID_компании
      INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
      WHERE c.ИНН_компании = ?
        AND (
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 1, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 4, 2) AS INTEGER) +
          CAST(SUBSTR(uw.Присутствие_относительно_длительности, 7, 2) AS INTEGER) / 60.0
        ) >= 1
      GROUP BY w.ID_вебинара, w.Название, w.Дата, uw.utm_campaign, uw.utm_medium
      ORDER BY w.Дата DESC
    `
    return this.execQuery(query, [inn])
  }

  // Получить участников компании
  getCompanyParticipants(inn: string) {
    const query = `
      SELECT DISTINCT
        e.Email as email,
        u.Имя as firstName,
        u.Фамилия as lastName,
        (SELECT uw.Должность 
         FROM "Участники-Вебинары" uw 
         WHERE uw.ID_участника = u.ID_участника 
         AND uw.Должность IS NOT NULL 
         LIMIT 1) as position
      FROM Участники u
      INNER JOIN Компания c ON u.ID_компании = c.ID_компании
      INNER JOIN Email e ON u.ID_участника = e.ID_участника
      WHERE c.ИНН_компании = ?
      ORDER BY e.Email
    `
    return this.execQuery(query, [inn])
  }
}

export default new DatabaseService()
