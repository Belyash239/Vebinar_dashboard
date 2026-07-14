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
    
    const webinarsResult = db.exec('SELECT COUNT(*) as count FROM Вебинары')
    const participantsResult = db.exec('SELECT COUNT(DISTINCT ID_участника) as count FROM Участники')
    const messagesResult = db.exec('SELECT COUNT(*) as count FROM Чат')
    const questionsResult = db.exec('SELECT COUNT(*) as count FROM Вопросы')
    
    return {
      totalWebinars: webinarsResult[0]?.values[0]?.[0] || 0,
      totalParticipants: participantsResult[0]?.values[0]?.[0] || 0,
      totalMessages: messagesResult[0]?.values[0]?.[0] || 0,
      totalQuestions: questionsResult[0]?.values[0]?.[0] || 0
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
  private execQuery(query: string) {
    const result = this.db!.exec(query)
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

  // Создать вебинар
  createWebinar(name: string, date: string) {
    this.db!.run(`INSERT INTO Вебинары (Название, Дата) VALUES (?, ?)`, [name, date])
    const result = this.db!.exec('SELECT last_insert_rowid() as id')
    this.save()
    return result[0].values[0][0] as number
  }

  // Добавить тег
  addTag(tagName: string) {
    this.db!.run(`INSERT OR IGNORE INTO Тег (Название_тега) VALUES (?)`, [tagName])
    
    const result = this.db!.exec('SELECT ID_тега FROM Тег WHERE Название_тега = ?', [tagName])
    this.save()
    return result.length > 0 ? result[0].values[0][0] as number : null
  }

  // Связать вебинар с тегом
  linkWebinarTag(webinarId: number, tagId: number) {
    this.db!.run(`INSERT OR IGNORE INTO "Вебинары-Теги" (ID_мероприятия, ID_тега) VALUES (?, ?)`, [webinarId, tagId])
    this.save()
  }

  // Получить или создать участника (ИНН обязателен)
  getOrCreateParticipant(firstName: string, lastName: string, inn: string) {
    // ИНН всегда присутствует и валиден (проверка в парсере)
    const result = this.db!.exec(`SELECT ID_участника FROM Участники WHERE ИНН_компании = ?`, [inn])

    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number
    }

    // Создаём нового участника
    this.db!.run(`INSERT INTO Участники (Имя, Фамилия, ИНН_компании) VALUES (?, ?, ?)`, [
      firstName || null, 
      lastName || null, 
      inn
    ])
    const idResult = this.db!.exec('SELECT last_insert_rowid() as id')
    this.save()
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
      this.save()
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
    this.save()
  }

  // Добавить сообщение чата
  addChatMessage(webinarId: number, emailId: number, time: string, message: string) {
    this.db!.run(`INSERT INTO Чат (ID_вебинара, ID_email, Время, Сообщение_чата) VALUES (?, ?, ?, ?)`, [
      webinarId, 
      emailId, 
      time || null, 
      message || null
    ])
    this.save()
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
    this.save()
  }

  // Удалить вебинар (откат при ошибке)
  deleteWebinar(webinarId: number) {
    // Удаляем в порядке зависимостей
    this.db!.run('DELETE FROM Чат WHERE ID_вебинара = ?', [webinarId])
    this.db!.run('DELETE FROM Вопросы WHERE ID_вебинара = ?', [webinarId])
    this.db!.run('DELETE FROM "Участники-Вебинары" WHERE ID_вебинара = ?', [webinarId])
    this.db!.run('DELETE FROM "Вебинары-Теги" WHERE ID_мероприятия = ?', [webinarId])
    this.db!.run('DELETE FROM Вебинары WHERE ID_вебинара = ?', [webinarId])
    this.save()
  }

  // Получить все теги
  getAllTags() {
    const query = `SELECT ID_тега as id, Название_тега as name FROM Тег ORDER BY Название_тега`
    return this.execQuery(query)
  }
}

export default new DatabaseService()
