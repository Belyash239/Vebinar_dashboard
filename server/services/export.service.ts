import { createRequire } from 'module'
import databaseService from '../database/database.service.js'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

class ExportService {
  // Экспорт чатов и вопросов для конкретного вебинара
  async exportWebinarData(webinarId: number): Promise<Buffer> {
    // Получаем чаты
    const chats = databaseService.execQueryForExport(`
      SELECT 
        w.Название as webinar_name,
        c.Время as time,
        e.Email as email,
        uw.Имя_в_чате as chat_name,
        c.Сообщение_чата as message
      FROM Чат c
      INNER JOIN Email e ON c.ID_email = e.ID_email
      INNER JOIN Вебинары w ON c.ID_вебинара = w.ID_вебинара
      LEFT JOIN "Участники-Вебинары" uw ON e.ID_участника = uw.ID_участника AND c.ID_вебинара = uw.ID_вебинара
      WHERE c.ID_вебинара = ?
      ORDER BY c.Время ASC
    `, [webinarId])

    // Получаем вопросы
    const questions = databaseService.execQueryForExport(`
      SELECT 
        w.Название as webinar_name,
        e.Email as author_email,
        v.Автор_вопроса as author_name,
        v.Вопрос as question,
        v.Статус_вопроса as status,
        v.Отвечающий as responder,
        v.Почта_отвечающего as responder_email,
        v.Ответы_и_комментарии as answers,
        v.Время_ответа as answer_time
      FROM Вопросы v
      INNER JOIN Email e ON v.ID_email = e.ID_email
      INNER JOIN Вебинары w ON v.ID_вебинара = w.ID_вебинара
      WHERE v.ID_вебинара = ?
      ORDER BY v.ID_вопроса ASC
    `, [webinarId])

    return this.createExcelFile(chats, questions)
  }

  // Экспорт чатов и вопросов по тегам
  async exportByTags(tagIds: number[]): Promise<Buffer> {
    const tagIdsStr = tagIds.join(',')
    const tagCount = tagIds.length

    // Получаем чаты только из вебинаров, у которых есть ВСЕ выбранные теги
    const chats = databaseService.execQueryForExport(`
      SELECT 
        w.Название as webinar_name,
        c.Время as time,
        e.Email as email,
        uw.Имя_в_чате as chat_name,
        c.Сообщение_чата as message
      FROM Чат c
      INNER JOIN Email e ON c.ID_email = e.ID_email
      INNER JOIN Вебинары w ON c.ID_вебинара = w.ID_вебинара
      LEFT JOIN "Участники-Вебинары" uw ON e.ID_участника = uw.ID_участника AND c.ID_вебинара = uw.ID_вебинара
      WHERE c.ID_вебинара IN (
        SELECT ID_мероприятия 
        FROM "Вебинары-Теги" 
        WHERE ID_тега IN (${tagIdsStr})
        GROUP BY ID_мероприятия
        HAVING COUNT(DISTINCT ID_тега) = ${tagCount}
      )
      ORDER BY w.Название, c.Время ASC
    `)

    // Получаем вопросы только из вебинаров, у которых есть ВСЕ выбранные теги
    const questions = databaseService.execQueryForExport(`
      SELECT 
        w.Название as webinar_name,
        e.Email as author_email,
        v.Автор_вопроса as author_name,
        v.Вопрос as question,
        v.Статус_вопроса as status,
        v.Отвечающий as responder,
        v.Почта_отвечающего as responder_email,
        v.Ответы_и_комментарии as answers,
        v.Время_ответа as answer_time
      FROM Вопросы v
      INNER JOIN Email e ON v.ID_email = e.ID_email
      INNER JOIN Вебинары w ON v.ID_вебинара = w.ID_вебинара
      WHERE v.ID_вебинара IN (
        SELECT ID_мероприятия 
        FROM "Вебинары-Теги" 
        WHERE ID_тега IN (${tagIdsStr})
        GROUP BY ID_мероприятия
        HAVING COUNT(DISTINCT ID_тега) = ${tagCount}
      )
      ORDER BY w.Название, v.ID_вопроса ASC
    `)

    return this.createExcelFile(chats, questions)
  }

  // Создание Excel файла с двумя листами
  private createExcelFile(chats: any[], questions: any[]): Buffer {
    const workbook = XLSX.utils.book_new()

    // Лист "Чаты"
    const chatsSheet = XLSX.utils.json_to_sheet(chats.map(chat => ({
      'Вебинар': chat.webinar_name || '',
      'Время': chat.time || '',
      'Email': chat.email || '',
      'Имя в чате': chat.chat_name || '',
      'Сообщение': chat.message || ''
    })))
    XLSX.utils.book_append_sheet(workbook, chatsSheet, 'Чаты')

    // Лист "Вопросы"
    const questionsSheet = XLSX.utils.json_to_sheet(questions.map(q => ({
      'Вебинар': q.webinar_name || '',
      'Email автора': q.author_email || '',
      'Автор': q.author_name || '',
      'Вопрос': q.question || '',
      'Статус': q.status || '',
      'Отвечающий': q.responder || '',
      'Email отвечающего': q.responder_email || '',
      'Ответы и комментарии': q.answers || '',
      'Время ответа': q.answer_time || ''
    })))
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Вопросы')

    // Конвертируем в Buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return buffer
  }

  // Парсинг файла с ИНН
  async parseInnFile(filePath: string, originalName: string): Promise<string[]> {
    const extension = originalName.split('.').pop()?.toLowerCase()
    const innList: string[] = []

    console.log(`  Парсинг файла: ${originalName} (расширение: ${extension})`)

    if (extension === 'txt') {
      // Читаем txt файл
      const fs = await import('fs')
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split(/\r?\n/)
      
      console.log(`  Найдено строк: ${lines.length}`)
      
      for (const line of lines) {
        const inn = line.trim()
        if (inn && /^\d{10}$|^\d{12}$/.test(inn)) {
          innList.push(inn)
        } else if (inn) {
          console.log(`  Пропущена строка (не ИНН): "${inn}"`)
        }
      }
    } else if (extension === 'xlsx') {
      // Читаем xlsx файл
      const workbook = XLSX.readFile(filePath)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
      
      console.log(`  Найдено строк в Excel: ${data.length}`)
      
      for (const row of data as any[]) {
        if (row && row.length > 0) {
          const inn = String(row[0]).trim()
          if (inn && /^\d{10}$|^\d{12}$/.test(inn)) {
            innList.push(inn)
          } else if (inn) {
            console.log(`  Пропущена строка (не ИНН): "${inn}"`)
          }
        }
      }
    } else {
      console.log(`  ❌ Неподдерживаемое расширение: ${extension}`)
    }

    console.log(`  Валидных ИНН найдено: ${innList.length}`)
    return [...new Set(innList)] // Убираем дубликаты
  }

  // Экспорт данных по списку ИНН
  async exportByInn(innList: string[]): Promise<Buffer> {
    if (innList.length === 0) {
      throw new Error('Список ИНН пуст')
    }

    const workbook = XLSX.utils.book_new()

    // Лист 1: Общая информация о компаниях
    const companiesData: any[] = []
    
    // Лист 2: Участники всех компаний
    const participantsData: any[] = []
    
    // Лист 3: Вебинары всех компаний
    const webinarsData: any[] = []
    
    // Лист 4: Чаты участников этих компаний
    const chatsData: any[] = []
    
    // Лист 5: Вопросы участников этих компаний
    const questionsData: any[] = []
    
    // Лист 6: Ответы на опросы участников этих компаний
    const surveyAnswersData: any[] = []

    for (const inn of innList) {
      console.log(`Экспорт данных для ИНН: ${inn}`)
      
      // Получаем информацию о компании
      const companyDetail = databaseService.getCompanyDetail(inn)
      
      if (!companyDetail) {
        console.log(`  ИНН ${inn} не найден в БД`)
        companiesData.push({
          'ИНН': inn,
          'Название компании': 'Не найдено',
          'Первый вебинар': '-',
          'Среднее удержание (%)': '-',
          'Всего вебинаров': 0,
          'Интересующие продукты': '-'
        })
        continue
      }

      // 1. Общая информация о компании
      companiesData.push({
        'ИНН': inn,
        'Название компании': companyDetail.companyName || '-',
        'Первый вебинар': companyDetail.firstWebinar || '-',
        'Среднее удержание (%)': companyDetail.avgRetention || 0,
        'Всего вебинаров': companyDetail.totalWebinars || 0,
        'Интересующие продукты': companyDetail.interestedProducts?.join(', ') || '-',
        'Статус': companyDetail.isNew === true ? 'Новая' : companyDetail.isNew === false ? 'Старая' : 'Не определено'
      })

      // 2. Получаем участников компании
      const participants = databaseService.getCompanyParticipants(inn)
      participants.forEach((p: any) => {
        participantsData.push({
          'ИНН компании': inn,
          'Название компании': companyDetail.companyName || '-',
          'Email': p.email || '-',
          'Имя': p.firstName || '-',
          'Фамилия': p.lastName || '-',
          'Должность': p.position || '-',
          'Телефон': p.phone || '-'
        })
      })

      // 3. Получаем вебинары компании с детальной информацией об участии
      // Делаем прямой запрос для получения всех данных из Участники-Вебинары
      const webinarsWithDetails = databaseService.execQueryForExport(`
        SELECT 
          w.ID_вебинара as webinarId,
          w.Название as webinarName,
          w.Дата as webinarDate,
          (SELECT GROUP_CONCAT(t2.Название_тега, ', ')
           FROM "Вебинары-Теги" wt2
           INNER JOIN Тег t2 ON wt2.ID_тега = t2.ID_тега
           WHERE wt2.ID_мероприятия = w.ID_вебинара) as tags,
          e.Email as email,
          u.Имя as firstName,
          u.Фамилия as lastName,
          u.Номер_телефона as phone,
          uw.Имя_в_чате as chatName,
          uw.Статус_регистрации as registrationStatus,
          uw.Дата_регистрации as registrationDate,
          uw.Источники as sources,
          uw.utm_source as utmSource,
          uw.utm_medium as utmMedium,
          uw.utm_campaign as utmCampaign,
          uw.utm_content as utmContent,
          uw.Платформа as platform,
          uw.Страна as country,
          uw.Город as city,
          uw.Последний_IP as lastIP,
          uw.Время_входа_первое as firstEntry,
          uw.Время_выхода_последнее as lastExit,
          uw.Присутствие_относительно_длительности as attendanceDuration,
          uw.Присутствие_от_общей_длительности as attendancePercent,
          uw.Кол_во_сообщений as messagesCount,
          uw.Процент_от_общего_кол_ва_сообщений as messagesPercent,
          uw.Кол_во_вопросов as questionsCount,
          uw.Процент_от_общего_кол_ва_вопросов as questionsPercent,
          uw.Количество_поднятых_рук as handsRaised,
          uw.Количество_отправленных_эмодзи_реакций as emojiReactions
        FROM "Участники-Вебинары" uw
        INNER JOIN Участники u ON uw.ID_участника = u.ID_участника
        INNER JOIN Email e ON u.ID_участника = e.ID_участника
        INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
        WHERE u.ID_компании = (SELECT ID_компании FROM Компания WHERE ИНН_компании = ?)
        ORDER BY w.Дата DESC, e.Email
      `, [inn])
      
      webinarsWithDetails.forEach((wd: any) => {
        webinarsData.push({
          'ИНН компании': inn,
          'Название компании': companyDetail.companyName || '-',
          'Email участника': wd.email || '-',
          'Имя': wd.firstName || '-',
          'Фамилия': wd.lastName || '-',
          'Телефон': wd.phone || '-',
          'Вебинар': wd.webinarName || '-',
          'Дата вебинара': wd.webinarDate || '-',
          'Теги': wd.tags || '-',
          'Имя в чате': wd.chatName || '-',
          'Статус регистрации': wd.registrationStatus || '-',
          'Дата регистрации': wd.registrationDate || '-',
          'Источники': wd.sources || '-',
          'UTM Source': wd.utmSource || '-',
          'UTM Medium': wd.utmMedium || '-',
          'UTM Campaign': wd.utmCampaign || '-',
          'UTM Content': wd.utmContent || '-',
          'Платформа': wd.platform || '-',
          'Страна': wd.country || '-',
          'Город': wd.city || '-',
          'Последний IP': wd.lastIP || '-',
          'Время входа (первое)': wd.firstEntry || '-',
          'Время выхода (последнее)': wd.lastExit || '-',
          'Присутствие (длительность)': wd.attendanceDuration || '-',
          'Присутствие (%)': wd.attendancePercent || '-',
          'Количество сообщений': wd.messagesCount || 0,
          'Процент сообщений': wd.messagesPercent || '-',
          'Количество вопросов': wd.questionsCount || 0,
          'Процент вопросов': wd.questionsPercent || '-',
          'Поднятых рук': wd.handsRaised || 0,
          'Эмодзи реакций': wd.emojiReactions || 0
        })
      })

      // 4-6. Для каждого участника компании получаем чаты, вопросы и ответы на опросы
      for (const participant of participants) {
        const email = participant.email
        
        // Чаты
        const chats = databaseService.getParticipantChat(email)
        chats.forEach((c: any) => {
          chatsData.push({
            'ИНН компании': inn,
            'Название компании': companyDetail.companyName || '-',
            'Email участника': email,
            'Вебинар': c.webinarName || '-',
            'Дата вебинара': c.webinarDate || '-',
            'Время': c.time || '-',
            'Сообщение': c.message || '-'
          })
        })
        
        // Вопросы
        const questions = databaseService.getParticipantQuestions(email)
        questions.forEach((q: any) => {
          questionsData.push({
            'ИНН компании': inn,
            'Название компании': companyDetail.companyName || '-',
            'Email участника': email,
            'Вебинар': q.webinarName || '-',
            'Дата вебинара': q.webinarDate || '-',
            'Вопрос': q.question || '-',
            'Статус': q.status || '-',
            'Отвечающий': q.responder || '-',
            'Ответ': q.answer || '-'
          })
        })
        
        // Ответы на опросы
        const surveyAnswers = databaseService.getParticipantSurveyAnswers(email)
        surveyAnswers.forEach((sa: any) => {
          surveyAnswersData.push({
            'ИНН компании': inn,
            'Название компании': companyDetail.companyName || '-',
            'Email участника': email,
            'Вебинар': sa.webinarName || '-',
            'Дата вебинара': sa.webinarDate || '-',
            'Вопрос опроса': sa.question || '-',
            'Ответ': sa.answer || '-'
          })
        })
      }
    }

    // Создаём листы Excel
    
    // Лист "Компании"
    const companiesSheet = XLSX.utils.json_to_sheet(companiesData.length > 0 ? companiesData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, companiesSheet, 'Компании')

    // Лист "Участники"
    const participantsSheet = XLSX.utils.json_to_sheet(participantsData.length > 0 ? participantsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, participantsSheet, 'Участники')

    // Лист "Вебинары"
    const webinarsSheet = XLSX.utils.json_to_sheet(webinarsData.length > 0 ? webinarsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, webinarsSheet, 'Вебинары')

    // Лист "Чаты"
    const chatsSheet = XLSX.utils.json_to_sheet(chatsData.length > 0 ? chatsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, chatsSheet, 'Чаты')

    // Лист "Вопросы"
    const questionsSheet = XLSX.utils.json_to_sheet(questionsData.length > 0 ? questionsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Вопросы')

    // Лист "Ответы на опросы"
    const surveyAnswersSheet = XLSX.utils.json_to_sheet(surveyAnswersData.length > 0 ? surveyAnswersData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, surveyAnswersSheet, 'Ответы на опросы')

    console.log(`Экспорт завершён:
  - Компаний: ${companiesData.length}
  - Участников: ${participantsData.length}
  - Вебинаров: ${webinarsData.length}
  - Чатов: ${chatsData.length}
  - Вопросов: ${questionsData.length}
  - Ответов на опросы: ${surveyAnswersData.length}`)

    // Конвертируем в Buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return buffer
  }
}

export default new ExportService()
