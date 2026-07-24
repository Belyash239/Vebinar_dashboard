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
}

export default new ExportService()
