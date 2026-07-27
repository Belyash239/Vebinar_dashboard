import { createRequire } from 'module'
import databaseService from '../database/database.service.js'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

class ParserService {
  // Парсинг основного файла (2 листа: участники и сеансы входов)
  async parseMainFile(filePath: string, webinarId: number | null): Promise<{ webinarName: string | null, webinarDate: string | null }> {
    const workbook = XLSX.readFile(filePath)
    
    // Найти лист "Участники" (первый не "Общая информация")
    const participantsSheetName = workbook.SheetNames.find((name: string) => 
      name.toLowerCase().includes('участник') || 
      (!name.toLowerCase().includes('общая') && !name.toLowerCase().includes('сеанс'))
    ) || workbook.SheetNames[0]
    
    const participantsSheet = workbook.Sheets[participantsSheetName]
    const participantsData = XLSX.utils.sheet_to_json(participantsSheet)

    console.log(`Парсинг основного файла: лист "${participantsSheetName}", строк: ${participantsData.length}`)
    
    // Выводим названия полей для отладки
    if (participantsData.length > 0) {
      console.log('Поля основного файла:', Object.keys(participantsData[0] as any).slice(0, 20))
    }

    // Извлекаем название вебинара и дату проведения из первой строки
    let webinarName: string | null = null
    let webinarDate: string | null = null
    
    if (participantsData.length > 0) {
      const firstRow = participantsData[0] as any
      
      // Извлекаем название вебинара
      const nameField = firstRow['Вебинар']
      if (nameField && typeof nameField === 'string') {
        webinarName = nameField.trim()
        console.log(`📝 Название вебинара: ${webinarName}`)
      }
      
      // Извлекаем дату
      const dateField = firstRow['Дата проведения']
      
      if (dateField) {
        // Excel даты могут быть в разных форматах
        if (typeof dateField === 'number') {
          // Excel serial date
          const date = XLSX.SSF.parse_date_code(dateField)
          webinarDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
        } else if (typeof dateField === 'string') {
          // Строковая дата, пытаемся распарсить
          const parsed = new Date(dateField)
          if (!isNaN(parsed.getTime())) {
            webinarDate = parsed.toISOString().split('T')[0]
          } else {
            webinarDate = dateField
          }
        }
        console.log(`📅 Дата проведения вебинара: ${webinarDate}`)
      }
    }
    
    // Если webinarId не передан, это первый проход - возвращаем только название и дату
    if (webinarId === null) {
      return { webinarName, webinarDate }
    }

    let processedCount = 0
    let skippedInnCount = 0
    let skippedNoEmailCount = 0
    let debugCount = 0

    for (const row of participantsData as any[]) {
      try {
        // Выводим первые 5 записей для отладки
        if (debugCount < 5) {
          console.log(`\nЗапись ${debugCount + 1}:`, {
            email: row['Email'],
            inn: row['ИНН компании'],
            имя: row['Имя'],
            фамилия: row['Фамилия']
          })
          debugCount++
        }

        // Пропускаем строки без Email (обязательное поле)
        if (!row['Email']) {
          skippedNoEmailCount++
          continue
        }

        // Валидация ИНН: только 10 или 12 цифр, обязательное поле
        const innValue = row['ИНН компании']
        
        // Если ИНН отсутствует или пустой - пропускаем запись
        if (!innValue || String(innValue).trim() === '') {
          skippedInnCount++
          if (skippedInnCount <= 5) {
            console.log(`⚠️ Пропущена запись без ИНН: Email=${row['Email']}`)
          }
          continue
        }
        
        const innStr = String(innValue).trim()
        
        // Проверяем, что ИНН содержит только цифры и длина 10 или 12
        if (!/^\d{10}$|^\d{12}$/.test(innStr)) {
          skippedInnCount++
          if (skippedInnCount <= 5) {
            console.log(`⚠️ Пропущена запись с некорректным ИНН: Email=${row['Email']}, ИНН="${innValue}" (должен быть 10 или 12 цифр)`)
          }
          continue
        }

        // Обработка номера телефона
        let phoneNumber = row['Телефон'] || row['Номер телефона'] || row['Мобильный телефон']
        if (phoneNumber) {
          // Если это число (Excel часто хранит телефоны как числа), конвертируем в строку
          if (typeof phoneNumber === 'number') {
            phoneNumber = String(phoneNumber)
          } else {
            phoneNumber = String(phoneNumber).trim()
          }
          
          // Удаляем пробелы, тире, скобки для нормализации
          phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '')
          
          // Если телефон начинается с 8, заменяем на +7
          if (phoneNumber.startsWith('8') && phoneNumber.length === 11) {
            phoneNumber = '+7' + phoneNumber.slice(1)
          }
          
          // Если телефон начинается с 7 без +, добавляем +
          if (phoneNumber.startsWith('7') && phoneNumber.length === 11 && !phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber
          }
          
          // Форматируем телефон: +7 XXX XXX-XX-XX
          if (phoneNumber.startsWith('+7') && phoneNumber.length === 12) {
            phoneNumber = `${phoneNumber.slice(0, 2)} ${phoneNumber.slice(2, 5)} ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8, 10)}-${phoneNumber.slice(10, 12)}`
          }
        }

        // Создать или получить участника (теперь ИНН всегда валидный)
        const participantId = databaseService.getOrCreateParticipant(
          row['Имя'] || '',
          row['Фамилия'] || '',
          innStr,
          phoneNumber || null,
          row['Компания']
        )

        // Создать или получить email
        const emailId = databaseService.getOrCreateEmail(row['Email'], participantId)

        // Добавить связь участник-вебинар
        // Парсим процент удержания из формата "99,69%" в число 99.69
        let attendancePercent = row['Присутствие от общей длительности мероприятия'] ||
                                row['Присутствие от общей длительности   мероприятия']
        
        if (attendancePercent && typeof attendancePercent === 'string') {
          // Убираем % и заменяем запятую на точку
          attendancePercent = parseFloat(attendancePercent.replace('%', '').replace(',', '.'))
        } else if (typeof attendancePercent === 'number') {
          // Если уже число, используем как есть
          attendancePercent = attendancePercent
        } else {
          attendancePercent = null
        }

        databaseService.addParticipantWebinar(participantId, webinarId, {
            chatName: row['Имя в чате'],
            company: row['Компания'],
            position: row['Должность'],
            registrationStatus: row['Статус регистрации'],
            registrationDate: row['Дата регистрации'],
            sources: row['Источники'],
            utmSource: row['utm_source'],
            utmMedium: row['utm_medium'],
            utmCampaign: row['utm_campaign'],
            utmContent: row['utm_content'],
            platform: row['Платформа'],
            country: row['Страна'],
            city: row['Город'],
            lastIP: row['Последний IP'],
            firstEntry: row['Время входа (первый)'],
            lastExit: row['Время выхода (последний)'],
            // Пробуем разные варианты названий с пробелами
            attendanceDuration: row['Присутствие относительно длительности мероприятия, чч:мм:сс'] || 
                               row['Присутствие относительно длительности   мероприятия, чч:мм:сс'] ||
                               row['Присутствие относительно длительности мероприятия'],
            attendancePercent: attendancePercent,
            messagesCount: row['Кол-во сообщений'] || 0,
            messagesPercent: row['Процент от общего кол-ва сообщений'],
            questionsCount: row['Кол-во вопросов'] || 0,
            questionsPercent: row['Процент от общего кол-ва вопросов'],
            handsRaised: row['Количество поднятых рук'] || 0,
            emojiReactions: row['Количество отправленных эмодзи реакций'] || 0
          })
        
        processedCount++
      } catch (error) {
        console.error('Ошибка при обработке строки участника:', error)
        throw error
      }
    }
    
    console.log(`✅ Импортировано участников: ${processedCount}`)
    if (skippedNoEmailCount > 0) {
      console.log(`⚠️ Пропущено записей без Email: ${skippedNoEmailCount}`)
    }
    if (skippedInnCount > 0) {
      console.log(`⚠️ Пропущено записей с некорректным/отсутствующим ИНН: ${skippedInnCount}`)
    }
    
    return { webinarName, webinarDate }
  }

  // Парсинг файла с вопросами
  async parseQuestionsFile(filePath: string, webinarId: number) {
    const workbook = XLSX.readFile(filePath)
    
    // Найти лист "Вопросы", пропустить "Общая информация"
    const questionsSheetName = workbook.SheetNames.find((name: string) => 
      name.toLowerCase().includes('вопрос') || 
      (!name.toLowerCase().includes('общая') && workbook.SheetNames.indexOf(name) > 0)
    ) || workbook.SheetNames[workbook.SheetNames.length > 1 ? 1 : 0]
    
    const sheet = workbook.Sheets[questionsSheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг вопросов: лист "${questionsSheetName}", строк: ${data.length}`)

    // Проверим первую строку для понимания структуры
    if (data.length > 0) {
      console.log('Первая строка вопросов (поля):', Object.keys(data[0] as any))
    }

    let processedCount = 0
    let notFoundCount = 0
    const notFoundEmails = new Set<string>()
    
    for (const row of data as any[]) {
      try {
        // Правильное название поля: "Почта автора вопроса"
        const authorEmail = row['Почта автора вопроса']
        
        if (authorEmail && authorEmail !== 'Нет регистрации') {
          // Найти email ID автора вопроса
          const db = databaseService.getDatabase()
          const result = db!.exec('SELECT ID_email FROM Email WHERE Email = ?', [authorEmail])

          if (result.length > 0 && result[0].values.length > 0) {
            const emailId = result[0].values[0][0] as number
            databaseService.addQuestion(webinarId, emailId, {
              author: null, // Автор определяется через email ID
              question: row['Вопрос'] || row['вопрос'],
              status: row['Статус вопроса'] || row['статус вопроса'] || row['Статус'],
              responder: row['Отвечающий'] || row['отвечающий'] || null,
              responderEmail: row['Почта отвечающего'] || row['почта отвечающего'] || null,
              answers: row['Ответы и комментарии'] || row['ответы и комментарии'] || row['Ответ'] || null,
              answerTime: row['Время ответа'] || row['время ответа'] || null
            })
            processedCount++
          } else {
            notFoundCount++
            notFoundEmails.add(authorEmail)
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке вопроса:', error)
      }
    }
    
    console.log(`✅ Импортировано вопросов: ${processedCount} из ${data.length}`)
    if (notFoundCount > 0) {
      console.log(`⚠️ Не найдено email для ${notFoundCount} вопросов`)
      console.log('Примеры не найденных email:', Array.from(notFoundEmails).slice(0, 5))
    }
  }

  // Парсинг файла с чатом
  async parseChatFile(filePath: string, webinarId: number) {
    const workbook = XLSX.readFile(filePath)
    
    // Найти лист "Сообщения чата", пропустить "Общая информация"
    const chatSheetName = workbook.SheetNames.find((name: string) => 
      name.toLowerCase().includes('чат') || name.toLowerCase().includes('сообщен') ||
      (!name.toLowerCase().includes('общая') && workbook.SheetNames.indexOf(name) > 0)
    ) || workbook.SheetNames[workbook.SheetNames.length > 1 ? 1 : 0]
    
    const sheet = workbook.Sheets[chatSheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг чата: лист "${chatSheetName}", строк: ${data.length}`)

    // Проверим первую строку для понимания структуры
    if (data.length > 0) {
      console.log('Первая строка чата (поля):', Object.keys(data[0] as any))
      console.log('Первая строка чата (значения):', data[0])
    }

    let processedCount = 0
    for (const row of data as any[]) {
      try {
        const email = row['Email участника'] || row['email'] || row['Email']
        
        if (email && email !== 'Нет регистрации') {
          // Найти email ID
          const db = databaseService.getDatabase()
          const result = db!.exec('SELECT ID_email FROM Email WHERE Email = ?', [email])

          if (result.length > 0 && result[0].values.length > 0) {
            const emailId = result[0].values[0][0] as number
            databaseService.addChatMessage(
              webinarId,
              emailId,
              row['Время'] || row['время'],
              row['Сообщение чата'] || row['Сообщение'] || row['message']
            )
            processedCount++
          } else if (processedCount < 5) {
            // Показываем только первые 5 ошибок
            console.log(`⚠️ Email не найден в БД для сообщения чата: ${email}`)
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке сообщения чата:', error)
      }
    }
    
    console.log(`✅ Импортировано сообщений чата: ${processedCount} из ${data.length}`)
  }
}

export default new ParserService()
