import { createRequire } from 'module'
import databaseService from '../database/database.service.js'
import { UNIQUE_FIELDS_POOL, autoMapColumns } from './field-mappings.js'
import ExcelJS from 'exceljs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

class ParserService {
  // Утилита: парсинг UTM меток формата Proofix (utm_campaign=main_rd, utm_medium=post)
  private parseProofixUtm(utmString: string) {
    const utmParams = {
      utm_source: null as string | null,
      utm_medium: null as string | null,
      utm_campaign: null as string | null,
      utm_content: null as string | null,
      utm_term: null as string | null,
      utm_custom: null as string | null
    }
    
    if (!utmString || typeof utmString !== 'string') return utmParams
    
    const pairs = utmString.split(',').map(p => p.trim())
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(p => p.trim())
      if (key && value) {
        if (key === 'utm_source') utmParams.utm_source = value
        else if (key === 'utm_medium') utmParams.utm_medium = value
        else if (key === 'utm_campaign') utmParams.utm_campaign = value
        else if (key === 'utm_content') utmParams.utm_content = value
        else if (key === 'utm_term') utmParams.utm_term = value
        else if (key === 'utm_custom') utmParams.utm_custom = value
      }
    }
    
    return utmParams
  }

  // Утилита: конвертация минут в HH:MM:SS
  private minutesToHHMMSS(minutes: number): string {
    if (!minutes || typeof minutes !== 'number') return '00:00:00'
    
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    const secs = Math.floor((minutes % 1) * 60)
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Парсинг основного файла (2 листа: участники и сеансы входов)
  async parseMainFile(filePath: string, webinarId: number | null, format: 'mts' | 'proofix' = 'mts'): Promise<{ webinarName: string | null, webinarDate: string | null }> {
    if (format === 'proofix') {
      return this.parseProofixMainFile(filePath, webinarId)
    }
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

        // Валидация ИНН: только 10 или 12 цифр (но НЕ обязательное поле)
        const innValue = row['ИНН компании']
        let innStr = ''
        
        // Если ИНН присутствует, проверяем его корректность
        if (innValue && String(innValue).trim() !== '') {
          innStr = String(innValue).trim()
          
          // Проверяем, что ИНН содержит только цифры и длина 10 или 12
          if (!/^\d{10}$|^\d{12}$/.test(innStr)) {
            if (skippedInnCount <= 5) {
              console.log(`⚠️ Некорректный ИНН для Email=${row['Email']}: "${innValue}" - участник будет без компании`)
            }
            skippedInnCount++
            innStr = '' // Пустой ИНН = участник без компании
          }
        } else {
          if (skippedInnCount <= 5) {
            console.log(`⚠️ Нет ИНН для Email=${row['Email']} - участник будет без компании`)
          }
          skippedInnCount++
          innStr = '' // Пустой ИНН = участник без компании
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

        // Создать или обновить участника по email (уникальность по email)
        const participantId = databaseService.getOrCreateParticipantByEmail(
          row['Email'],
          row['Имя'] || '',
          row['Фамилия'] || '',
          innStr, // Может быть пустой строкой
          phoneNumber || null,
          row['Компания'],
          row['Должность'] || null
        )

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
            registrationStatus: row['Статус регистрации'],
            registrationDate: row['Дата регистрации'],
            sources: row['Источники'],
            utmSource: row['utm_source'],
            utmMedium: row['utm_medium'],
            utmCampaign: row['utm_campaign'],
            utmContent: row['utm_content'],
            utmTerm: row['utm_term'],
            utmCustom: row['utm_custom'],
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

  // Парсинг основного файла Proofix (лист с регистрациями)
  private async parseProofixMainFile(filePath: string, webinarId: number | null): Promise<{ webinarName: string | null, webinarDate: string | null }> {
    console.log(`\n🔧 === НАЧАЛО ПАРСИНГА РЕГИСТРАЦИЙ PROOFIX ===`)
    console.log(`📁 Файл: ${filePath}`)
    console.log(`🆔 ID вебинара: ${webinarId || 'NULL (первый проход)'}`)
    
    const workbook = XLSX.readFile(filePath)
    
    // Найти лист с регистрациями (первый не пустой лист)
    const regSheetName = workbook.SheetNames[0]
    const regSheet = workbook.Sheets[regSheetName]
    const regData = XLSX.utils.sheet_to_json(regSheet)

    console.log(`📋 Лист: "${regSheetName}"`)
    console.log(`📊 Строк данных: ${regData.length}`)
    
    if (regData.length > 0) {
      console.log('📋 Поля Proofix регистраций:', Object.keys(regData[0] as any))
    }

    // Для Proofix название и дату вебинара нужно получить из другого источника
    // Возвращаем null, так как эти данные не в файле регистраций
    let webinarName: string | null = null
    let webinarDate: string | null = null
    
    if (webinarId === null) {
      console.log(`⚠️ webinarId = NULL, записи НЕ создаются (первый проход)`)
      console.log(`🔧 === КОНЕЦ ПАРСИНГА РЕГИСТРАЦИЙ PROOFIX ===\n`)
      return { webinarName, webinarDate }
    }
    
    console.log(`✓ webinarId определён, начинаем создание записей участник-вебинар...`)

    let processedCount = 0
    let skippedInnCount = 0
    let skippedNoEmailCount = 0

    for (const row of regData as any[]) {
      try {
        if (!row['Email']) {
          skippedNoEmailCount++
          continue
        }

        // Валидация ИНН
        const innValue = row['ИНН']
        let innStr = ''
        
        if (innValue && String(innValue).trim() !== '') {
          innStr = String(innValue).trim()
          
          if (!/^\d{10}$|^\d{12}$/.test(innStr)) {
            skippedInnCount++
            innStr = ''
          }
        } else {
          skippedInnCount++
          innStr = ''
        }

        // Обработка телефона
        let phoneNumber = row['Телефон']
        if (phoneNumber) {
          if (typeof phoneNumber === 'number') {
            phoneNumber = String(phoneNumber)
          } else {
            phoneNumber = String(phoneNumber).trim()
          }
          
          phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '')
          
          if (phoneNumber.startsWith('8') && phoneNumber.length === 11) {
            phoneNumber = '+7' + phoneNumber.slice(1)
          }
          
          if (phoneNumber.startsWith('7') && phoneNumber.length === 11 && !phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber
          }
          
          if (phoneNumber.startsWith('+7') && phoneNumber.length === 12) {
            phoneNumber = `${phoneNumber.slice(0, 2)} ${phoneNumber.slice(2, 5)} ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8, 10)}-${phoneNumber.slice(10, 12)}`
          }
        }

        // Парсим UTM метки
        const utmParams = this.parseProofixUtm(row['Utm метки'] || '')

        // Создать участника
        const participantId = databaseService.getOrCreateParticipantByEmail(
          row['Email'],
          row['Имя'] || '',
          row['Фамилия'] || '',
          innStr,
          phoneNumber || null,
          undefined, // Название компании не в регистрациях
          undefined
        )

        // Добавить связь участник-вебинар
        databaseService.addParticipantWebinar(participantId, webinarId, {
          chatName: null,
          company: null,
          registrationStatus: 'Зарегистрирован',
          registrationDate: row['Дата создания'] || null,
          sources: row['Источник'] || null,
          utmSource: utmParams.utm_source,
          utmMedium: utmParams.utm_medium,
          utmCampaign: utmParams.utm_campaign,
          utmContent: utmParams.utm_content,
          utmTerm: utmParams.utm_term,
          utmCustom: utmParams.utm_custom,
          platform: null,
          country: null,
          city: null,
          lastIP: null,
          firstEntry: null,
          lastExit: null,
          attendanceDuration: null,
          attendancePercent: null,
          messagesCount: 0,
          messagesPercent: null,
          questionsCount: 0,
          questionsPercent: null,
          handsRaised: 0,
          emojiReactions: 0
        })
        
        processedCount++
      } catch (error) {
        console.error('Ошибка при обработке строки регистрации Proofix:', error)
      }
    }
    
    console.log(`\n✅ Импортировано регистраций Proofix: ${processedCount}`)
    if (skippedNoEmailCount > 0) {
      console.log(`⚠️ Пропущено записей без Email: ${skippedNoEmailCount}`)
    }
    if (skippedInnCount > 0) {
      console.log(`⚠️ Пропущено записей с некорректным/отсутствующим ИНН: ${skippedInnCount}`)
    }
    console.log(`🔧 === КОНЕЦ ПАРСИНГА РЕГИСТРАЦИЙ PROOFIX ===\n`)
    
    return { webinarName, webinarDate }
  }

  // Парсинг файла с вопросами
  async parseQuestionsFile(filePath: string, webinarId: number, format: 'mts' | 'proofix' = 'mts') {
    if (format === 'proofix') {
      // Proofix не имеет отдельного листа с вопросами
      console.log('⚠️ Proofix не поддерживает отдельный файл вопросов')
      return
    }
    const workbook = XLSX.readFile(filePath)
    
    // Найти лист "Вопросы"
    let questionsSheetName = workbook.SheetNames.find((name: string) => 
      name.toLowerCase().includes('вопрос')
    )
    
    // Если не найден, берём первый неслужебный лист
    if (!questionsSheetName) {
      questionsSheetName = workbook.SheetNames.find((name: string) => {
        const lower = name.toLowerCase()
        return !lower.includes('общая') && !lower.includes('информация')
      })
    }
    
    // Если всё ещё не найден - берём второй лист (первый обычно "Общая информация")
    if (!questionsSheetName) {
      questionsSheetName = workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0]
    }
    
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
          const stmt = db!.prepare('SELECT ID_email FROM Email WHERE Email = ?')
          const result = stmt.get(authorEmail) as { ID_email: number } | undefined

          if (result) {
            const emailId = result.ID_email
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
  async parseChatFile(filePath: string, webinarId: number, format: 'mts' | 'proofix' = 'mts') {
    if (format === 'proofix') {
      return this.parseProofixChatFile(filePath, webinarId)
    }
    
    const workbook = XLSX.readFile(filePath)
    
    // Найти лист "Сообщения чата" или "Чат"
    let chatSheetName = workbook.SheetNames.find((name: string) => {
      const lower = name.toLowerCase()
      return lower.includes('чат') || lower.includes('сообщен')
    })
    
    // Если не найден, берём первый неслужебный лист
    if (!chatSheetName) {
      chatSheetName = workbook.SheetNames.find((name: string) => {
        const lower = name.toLowerCase()
        return !lower.includes('общая') && !lower.includes('информация')
      })
    }
    
    // Если всё ещё не найден - берём второй лист (первый обычно "Общая информация")
    if (!chatSheetName) {
      chatSheetName = workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0]
    }
    
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
          const stmt = db!.prepare('SELECT ID_email FROM Email WHERE Email = ?')
          const result = stmt.get(email) as { ID_email: number } | undefined

          if (result) {
            const emailId = result.ID_email
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

  // Парсинг файла с опросами
  async parseSurveyFile(filePath: string, webinarId: number | null, importPositions: boolean = false, format: 'mts' | 'proofix' = 'mts') {
    if (format === 'proofix') {
      return this.parseProofixSurveyFile(filePath, webinarId, importPositions)
    }
    
    const workbook = XLSX.readFile(filePath)
    
    console.log('📋 Все листы в файле опросов:', workbook.SheetNames)
    
    // Ищем лист "Ответы" - ТОЧНОЕ совпадение в первую очередь
    let surveySheetName = workbook.SheetNames.find((name: string) => {
      const trimmedLower = name.trim().toLowerCase()
      return trimmedLower === 'ответы'
    })
    
    if (surveySheetName) {
      console.log(`✅ Найден лист с точным названием "Ответы": "${surveySheetName}"`)
    }
    
    // Если точное совпадение не найдено, ищем по префиксу "ответ", но ИСКЛЮЧАЕМ "Вопрос" и служебные листы
    if (!surveySheetName) {
      surveySheetName = workbook.SheetNames.find((name: string) => {
        const trimmedLower = name.trim().toLowerCase()
        // Должно начинаться на "ответ", но НЕ быть "вопрос" и НЕ содержать "информация"
        const startsWithAnswer = trimmedLower.startsWith('ответ')
        const isQuestion = trimmedLower.includes('вопрос')
        const isInfo = trimmedLower.includes('информация')
        const matches = startsWithAnswer && !isQuestion && !isInfo
        console.log(`  Проверка листа "${name}": startsWith(ответ)=${startsWithAnswer}, includes(вопрос)=${isQuestion}, includes(информация)=${isInfo} → ${matches ? '✓' : '✗'}`)
        return matches
      })
      
      if (surveySheetName) {
        console.log(`✅ Найден лист с префиксом "Ответ": "${surveySheetName}"`)
      }
    }
    
    // Если не найден, берём первый лист, который НЕ служебный
    if (!surveySheetName) {
      // Пропускаем служебные листы: "Информация об опросе", "Общая информация", "Вопрос 1", "Вопрос 2", "География", "Сеансы"
      surveySheetName = workbook.SheetNames.find((name: string) => {
        const lower = name.toLowerCase()
        return !lower.includes('информация') && 
               !lower.includes('общая') && 
               !lower.includes('вопрос') &&
               !lower.includes('география') &&
               !lower.includes('сеанс')
      })
      
      // Если все листы служебные - берём первый
      if (!surveySheetName) {
        surveySheetName = workbook.SheetNames[0]
      }
      
      console.log(`⚠️ Лист с "Ответ" не найден, используется первый неслужебный лист: "${surveySheetName}"`)
    }
    
    const sheet = workbook.Sheets[surveySheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг опросов МТС-линк: лист "${surveySheetName}", строк: ${data.length}`)
    console.log(`Привязка к вебинару: ${webinarId ? `ID ${webinarId}` : 'Не привязано'}`)

    // Проверим первую строку для понимания структуры
    if (data.length > 0) {
      console.log('Первая строка опросов (поля):', Object.keys(data[0] as any))
    }

    let processedCount = 0
    let notFoundCount = 0
    let totalAnswers = 0
    let positionsUpdated = 0
    const notFoundEmails = new Set<string>()
    
    // ID опроса генерируется автоматически как следующий доступный ID
    // Связь с вебинаром происходит через таблицу "Вебинары-Опросы"
    const surveyId = databaseService.getNextSurveyId()
    
    for (const row of data as any[]) {
      try {
        // Поля: Участник (имя), Email, затем вопросы
        const email = row['Email'] || row['email'] || row['E-mail']
        
        if (!email) {
          continue
        }
        
        // Найти email ID
        const db = databaseService.getDatabase()
        const stmt = db!.prepare('SELECT e.ID_email, e.ID_участника FROM Email e WHERE e.Email = ?')
        const emailResult = stmt.get(email) as { ID_email: number, ID_участника: number } | undefined

        if (emailResult) {
          const emailId = emailResult.ID_email
          const participantId = emailResult.ID_участника
          
          let positionFound = false
          
          // Перебираем все поля, кроме "Участник" и "Email"
          const allFields = Object.keys(row)
          for (const field of allFields) {
            // Пропускаем служебные поля
            if (field === 'Участник' || field === 'участник' || 
                field === 'Email' || field === 'email' || field === 'E-mail') {
              continue
            }
            
            // Поле - это вопрос, значение - это ответ
            const question = field.trim()
            const answer = row[field]
            
            // Пропускаем пустые ответы
            if (!answer || String(answer).trim() === '') {
              continue
            }
            
            const answerStr = String(answer).trim()
            
            // Проверяем, является ли это поле должностью
            if (importPositions && !positionFound) {
              const questionLower = question.toLowerCase()
              const answerLower = answerStr.toLowerCase()
              
              // Проверяем ключевые слова в вопросе или ответе
              const isPositionField = 
                questionLower.includes('должность') ||
                questionLower.includes('кем работаете') ||
                questionLower.includes('кто вы') ||
                questionLower.includes('ваша роль') ||
                questionLower.includes('позиция') ||
                answerLower.includes('бухгалтер') ||
                answerLower.includes('директор') ||
                answerLower.includes('менеджер') ||
                answerLower.includes('специалист') ||
                answerLower.includes('руководитель')
              
              if (isPositionField) {
                // Обновляем должность участника
                databaseService.updateParticipantPosition(participantId, answerStr)
                positionFound = true
                positionsUpdated++
                console.log(`Обновлена должность для ${email}: ${answerStr}`)
              }
            }
            
            // Добавляем вопрос и ответ (с webinarId или без него)
            databaseService.addSurveyQuestion(surveyId, question, webinarId, emailId, answerStr)
            totalAnswers++
          }
          
          processedCount++
        } else {
          notFoundCount++
          notFoundEmails.add(email)
        }
      } catch (error) {
        console.error('Ошибка при обработке опроса:', error)
      }
    }
    
    console.log(`✅ Обработано участников: ${processedCount} из ${data.length}`)
    console.log(`✅ Импортировано ответов на опросы: ${totalAnswers}`)
    if (importPositions) {
      console.log(`✅ Обновлено должностей: ${positionsUpdated}`)
    }
    if (notFoundCount > 0) {
      console.log(`⚠️ Не найдено email для ${notFoundCount} участников`)
      console.log('Примеры не найденных email:', Array.from(notFoundEmails).slice(0, 5))
    }
  }

  // Парсинг файла с присутствием Proofix (обновляет данные из регистраций)
  async parseProofixAttendanceFile(filePath: string, webinarId: number) {
    console.log(`\n🔧 === НАЧАЛО ПАРСИНГА ПРИСУТСТВИЯ PROOFIX ===`)
    console.log(`📁 Файл: ${filePath}`)
    console.log(`🆔 ID вебинара: ${webinarId}`)
    
    const workbook = XLSX.readFile(filePath)
    const attendanceSheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[attendanceSheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`📋 Лист: "${attendanceSheetName}"`)
    console.log(`📊 Строк данных: ${data.length}`)

    if (data.length > 0) {
      console.log('📋 Поля присутствия Proofix:', Object.keys(data[0] as any))
      console.log('📋 Первая строка (пример):', data[0])
    }

    let processedCount = 0
    let notFoundCount = 0
    let maxAttendanceMinutes = 0

    for (const row of data as any[]) {
      try {
        const email = row['Email'] || row['email']
        
        if (!email) {
          continue
        }

        const db = databaseService.getDatabase()
        const stmt = db!.prepare('SELECT ID_email, ID_участника FROM Email WHERE Email = ?')
        const emailResult = stmt.get(email) as { ID_email: number, ID_участника: number } | undefined

        if (emailResult) {
          const emailId = emailResult.ID_email
          const participantId = emailResult.ID_участника
          
          console.log(`  ✓ Найден участник для ${email}: ID=${participantId}`)
          
          // Конвертируем минуты в HH:MM:SS
          const attendanceMinutes = row['Продолжительность присутствия участника,   минут'] || 
                                    row['Продолжительность присутствия участника, минут'] ||
                                    row['Продолжительность присутствия участника'] ||
                                    0
          
          // Отслеживаем максимальную продолжительность для определения длительности вебинара
          if (attendanceMinutes > maxAttendanceMinutes) {
            maxAttendanceMinutes = attendanceMinutes
          }
          
          const attendanceDuration = this.minutesToHHMMSS(attendanceMinutes)
          
          console.log(`    Присутствие: ${attendanceMinutes} мин → ${attendanceDuration}`)
          
          // Вычисляем процент (если есть общая длительность вебинара)
          let attendancePercent = null
          
          // Парсим UTM метки
          const utmParams = this.parseProofixUtm(row['Utm метки'] || '')
          
          // Обновляем запись участник-вебинар
          const updateResult = db!.prepare(`
            UPDATE "Участники-Вебинары"
            SET 
              Присутствие_относительно_длительности = ?,
              Присутствие_от_общей_длительности = ?,
              utm_source = ?,
              utm_medium = ?,
              utm_campaign = ?,
              utm_content = ?,
              utm_term = ?,
              utm_custom = ?
            WHERE ID_участника = ? AND ID_вебинара = ?
          `).run(
            attendanceDuration,
            attendancePercent,
            utmParams.utm_source,
            utmParams.utm_medium,
            utmParams.utm_campaign,
            utmParams.utm_content,
            utmParams.utm_term,
            utmParams.utm_custom,
            participantId,
            webinarId
          )
          
          console.log(`    UPDATE результат: changes=${updateResult.changes}`)
          
          processedCount++
        } else {
          console.log(`  ✗ Email НЕ найден: ${email}`)
          notFoundCount++
        }
      } catch (error) {
        console.error('Ошибка при обработке присутствия Proofix:', error)
      }
    }
    
    // Пересчитываем проценты присутствия на основе максимальной продолжительности
    if (maxAttendanceMinutes > 0) {
      const db = databaseService.getDatabase()
      
      console.log(`📊 Максимальная продолжительность присутствия: ${maxAttendanceMinutes} мин`)
      
      // Получаем всех участников этого вебинара с их продолжительностью присутствия
      const participants = db!.prepare(`
        SELECT 
          ID_участника,
          Присутствие_относительно_длительности
        FROM "Участники-Вебинары"
        WHERE ID_вебинара = ?
          AND Присутствие_относительно_длительности IS NOT NULL
      `).all(webinarId) as { ID_участника: number, Присутствие_относительно_длительности: string }[]
      
      if (participants.length > 0) {
        for (const row of participants) {
          const participantId = row.ID_участника
          const duration = row.Присутствие_относительно_длительности
          
          if (duration) {
            // Парсим HH:MM:SS в секунды
            const parts = duration.split(':')
            const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
            
            // Вычисляем процент от максимальной продолжительности
            const percent = (seconds * 100.0) / (maxAttendanceMinutes * 60)
            const percentStr = percent.toFixed(2).replace('.', ',') + '%'
            
            // Обновляем запись
            db!.prepare(`
              UPDATE "Участники-Вебинары"
              SET Присутствие_от_общей_длительности = ?
              WHERE ID_участника = ? AND ID_вебинара = ?
            `).run(percentStr, participantId, webinarId)
          }
        }
        
        console.log(`📊 Пересчитаны проценты присутствия для ${participants.length} участников`)
      }
    }
    
    console.log(`\n✅ Обновлено записей присутствия Proofix: ${processedCount} из ${data.length}`)
    if (notFoundCount > 0) {
      console.log(`⚠️ Не найдено email для ${notFoundCount} записей присутствия`)
    }
    console.log(`🔧 === КОНЕЦ ПАРСИНГА ПРИСУТСТВИЯ PROOFIX ===\n`)
  }

  // Парсинг файла с чатом Proofix
  private async parseProofixChatFile(filePath: string, webinarId: number) {
    const workbook = XLSX.readFile(filePath)
    const chatSheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[chatSheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг чата Proofix: лист "${chatSheetName}", строк: ${data.length}`)

    if (data.length > 0) {
      console.log('Поля чата Proofix:', Object.keys(data[0] as any))
    }

    let processedCount = 0
    for (const row of data as any[]) {
      try {
        const email = row['email участника мероприятия'] || row['Email участника'] || row['email']
        
        if (email && email !== 'Нет регистрации') {
          const db = databaseService.getDatabase()
          const stmt = db!.prepare('SELECT ID_email FROM Email WHERE Email = ?')
          const result = stmt.get(email) as { ID_email: number } | undefined

          if (result) {
            const emailId = result.ID_email
            
            // Добавляем сообщение с дополнительными полями Proofix
            const messageId = row['ID_сообщения'] || null
            const parentMessageId = row['ID-сообщения родителя'] || row['ID_сообщения_родителя'] || null
            const message = row['Сообщение'] || ''
            const timestamp = row['Дата создания'] || null
            const chatName = row['Имя участника в чате'] || null
            const likes = row['Кол-во лайков сообщения'] || 0
            const dislikes = row['Кол-во диз лайков сообщения'] || row['Кол-во дизлайков сообщения'] || 0
            const ipAddress = row['IP-адрес c которого отправлено сообщение'] || row['IP-адрес'] || null
            
            databaseService.addChatMessage(webinarId, emailId, timestamp, message)
            processedCount++
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке сообщения чата Proofix:', error)
      }
    }
    
    console.log(`✅ Импортировано сообщений чата Proofix: ${processedCount} из ${data.length}`)
  }

  // Парсинг файла с опросами Proofix
  private async parseProofixSurveyFile(filePath: string, webinarId: number | null, importPositions: boolean = false) {
    const workbook = XLSX.readFile(filePath)
    const surveySheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[surveySheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг опросов Proofix: лист "${surveySheetName}", строк: ${data.length}`)
    console.log(`Привязка к вебинару: ${webinarId ? `ID ${webinarId}` : 'Не привязано'}`)

    if (data.length > 0) {
      console.log('Поля опросов Proofix:', Object.keys(data[0] as any))
    }

    let processedCount = 0
    let notFoundCount = 0
    let totalAnswers = 0
    let positionsUpdated = 0
    const notFoundEmails = new Set<string>()
    
    const surveyId = databaseService.getNextSurveyId()
    
    for (const row of data as any[]) {
      try {
        const email = row['Email'] || row['email'] || row['E-mail']
        
        if (!email) {
          continue
        }
        
        const db = databaseService.getDatabase()
        const stmt = db!.prepare('SELECT e.ID_email, e.ID_участника FROM Email e WHERE e.Email = ?')
        const emailResult = stmt.get(email) as { ID_email: number, ID_участника: number } | undefined

        if (emailResult) {
          const emailId = emailResult.ID_email
          const participantId = emailResult.ID_участника
          
          let positionFound = false
          
          const allFields = Object.keys(row)
          for (const field of allFields) {
            // Пропускаем служебные поля
            if (field === 'Имя' || field === 'имя' || 
                field === 'Фамилия' || field === 'фамилия' ||
                field === 'Email' || field === 'email' || field === 'E-mail' ||
                field === 'Телефон' || field === 'телефон' ||
                field === 'ИНН' || field === 'инн' ||
                field === 'Дата создания' || field === 'дата создания' ||
                field === 'Последний вход' || field === 'последний вход') {
              continue
            }
            
            // Пропускаем поля "Дата ответа" (они идут парой с вопросами)
            if (field.toLowerCase().includes('дата ответа')) {
              continue
            }
            
            // Пропускаем технические поля Proofix (CODE и другие служебные)
            const fieldUpper = field.toUpperCase().trim()
            if (fieldUpper === 'CODE' || fieldUpper === 'ID' || fieldUpper === 'UUID' || fieldUpper === 'GUID') {
              continue
            }
            
            const question = field.trim()
            const answer = row[field]
            
            if (!answer || String(answer).trim() === '') {
              continue
            }
            
            const answerStr = String(answer).trim()
            
            // Проверяем должность
            if (importPositions && !positionFound) {
              const questionLower = question.toLowerCase()
              const answerLower = answerStr.toLowerCase()
              
              const isPositionField = 
                questionLower.includes('должность') ||
                questionLower.includes('роль') ||
                questionLower.includes('кем работаете') ||
                questionLower.includes('кто вы') ||
                questionLower.includes('ваша позиция') ||
                answerLower.includes('бухгалтер') ||
                answerLower.includes('директор') ||
                answerLower.includes('менеджер') ||
                answerLower.includes('специалист') ||
                answerLower.includes('руководитель')
              
              if (isPositionField) {
                databaseService.updateParticipantPosition(participantId, answerStr)
                positionFound = true
                positionsUpdated++
                console.log(`Обновлена должность для ${email}: ${answerStr}`)
              }
            }
            
            databaseService.addSurveyQuestion(surveyId, question, webinarId, emailId, answerStr)
            totalAnswers++
          }
          
          processedCount++
        } else {
          notFoundCount++
          notFoundEmails.add(email)
        }
      } catch (error) {
        console.error('Ошибка при обработке опроса Proofix:', error)
      }
    }
    
    console.log(`✅ Обработано участников Proofix: ${processedCount} из ${data.length}`)
    console.log(`✅ Импортировано ответов на опросы Proofix: ${totalAnswers}`)
    if (importPositions) {
      console.log(`✅ Обновлено должностей Proofix: ${positionsUpdated}`)
    }
    if (notFoundCount > 0) {
      console.log(`⚠️ Не найдено email для ${notFoundCount} участников`)
      console.log('Примеры не найденных email:', Array.from(notFoundEmails).slice(0, 5))
    }
  }

  // Определить тип файла по названиям листов (быстрее чем читать колонки)
  async detectFileTypeBySheets(filePath: string): Promise<'main' | 'survey' | 'chat' | 'questions' | 'attendance' | 'unknown'> {
    const workbook = XLSX.readFile(filePath, { sheetRows: 1 }) // Читаем первую строку для определения колонок
    const sheetNames = workbook.SheetNames.map((name: string) => name.toLowerCase())
    
    console.log('🔍 Определение типа файла по листам:', workbook.SheetNames)
    
    // Опросы: есть лист "Ответы"
    if (sheetNames.some((name: string) => name.trim() === 'ответы' || (name.startsWith('ответ') && !name.includes('вопрос')))) {
      console.log('  ✓ Тип: ОПРОС (найден лист "Ответы")')
      return 'survey'
    }
    
    // Вопросы: есть лист "Вопросы" но нет "Ответы"
    if (sheetNames.some((name: string) => name.includes('вопрос'))) {
      console.log('  ✓ Тип: ВОПРОСЫ (найден лист "Вопрос")')
      return 'questions'
    }
    
    // Чат: есть лист "Чат" или "Сообщения"
    if (sheetNames.some((name: string) => name.includes('чат') || name.includes('сообщен'))) {
      console.log('  ✓ Тип: ЧАТ (найден лист "Чат")')
      return 'chat'
    }
    
    // Участники: есть лист "Участники" - нужно проверить колонки для различения main/attendance
    if (sheetNames.some((name: string) => name.includes('участник'))) {
      // Читаем первую строку (заголовки) для проверки типа
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] as string[]
      
      if (headers) {
        const headerStr = headers.join('|').toLowerCase()
        
        // Проверяем наличие колонок присутствия
        if (headerStr.includes('продолжительность присутствия') || 
            headerStr.includes('контроля присутствия')) {
          console.log('  ✓ Тип: ПРИСУТСТВИЕ (найдены колонки присутствия)')
          return 'attendance'
        }
        
        // Проверяем наличие колонок опросов
        if (headerStr.includes('последний вход') && 
            (headerStr.includes('дата ответа') || headers.length > 15)) {
          console.log('  ✓ Тип: ОПРОС (найдены колонки опросов)')
          return 'survey'
        }
      }
      
      console.log('  ✓ Тип: ОСНОВНОЙ (найден лист "Участники")')
      return 'main'
    }
    
    // По умолчанию - основной файл
    console.log('  ✓ Тип: ОСНОВНОЙ (по умолчанию)')
    return 'main'
  }

  // Прочитать колонки из Excel файла (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ для больших файлов)
  async readExcelColumns(filePath: string, fileType: 'main' | 'survey' | 'chat' | 'questions' | 'attendance' = 'main'): Promise<{ columns: string[], rowCount: number }> {
    console.log('⚡ Быстрое чтение колонок через exceljs...')
    
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      sharedStrings: 'cache',
      worksheets: 'emit'
    })

    const columns: string[] = []
    let rowCount = 0
    let sheetName = ''
    let headerFound = false
    
    // Собираем все листы для выбора правильного
    const sheets: Array<{ name: string, reader: any }> = []
    
    for await (const worksheetReader of workbookReader) {
      // @ts-ignore
      const name = worksheetReader.name || 'Unknown'
      sheets.push({ name, reader: worksheetReader })
    }
    
    console.log(`📋 Найдено листов: ${sheets.length}`)
    sheets.forEach(s => console.log(`  - "${s.name}"`))
    
    // Выбираем лист в зависимости от типа файла
    let targetSheet: { name: string, reader: any } | undefined
    
    if (fileType === 'survey') {
      // Для опросов: ищем лист "Ответы" точно, затем по префиксу (исключая "Вопрос"), затем первый неслужебный
      targetSheet = sheets.find(s => s.name.trim().toLowerCase() === 'ответы')
      
      if (!targetSheet) {
        targetSheet = sheets.find(s => {
          const lower = s.name.trim().toLowerCase()
          return lower.startsWith('ответ') && !lower.includes('вопрос') && !lower.includes('информация')
        })
      }
      
      if (!targetSheet) {
        targetSheet = sheets.find(s => {
          const lower = s.name.toLowerCase()
          return !lower.includes('информация') && 
                 !lower.includes('общая') && 
                 !lower.includes('вопрос') &&
                 !lower.includes('география') &&
                 !lower.includes('сеанс')
        })
      }
    } else if (fileType === 'chat') {
      // Для чата: ищем "Чат" или "Сообщен"
      targetSheet = sheets.find(s => {
        const lower = s.name.toLowerCase()
        return lower.includes('чат') || lower.includes('сообщен')
      })
      
      if (!targetSheet) {
        targetSheet = sheets.find(s => {
          const lower = s.name.toLowerCase()
          return !lower.includes('общая') && 
                 !lower.includes('сеанс') && 
                 !lower.includes('информация') &&
                 !lower.includes('география')
        })
      }
    } else if (fileType === 'questions') {
      // Для вопросов: ищем "Вопрос"
      targetSheet = sheets.find(s => s.name.toLowerCase().includes('вопрос'))
      
      if (!targetSheet) {
        targetSheet = sheets.find(s => {
          const lower = s.name.toLowerCase()
          return !lower.includes('общая') && 
                 !lower.includes('сеанс') && 
                 !lower.includes('информация') &&
                 !lower.includes('география')
        })
      }
    } else if (fileType === 'attendance') {
      // Для присутствия: берём первый неслужебный лист (обычно единственный)
      targetSheet = sheets.find(s => {
        const lower = s.name.toLowerCase()
        return !lower.includes('общая') && 
               !lower.includes('сеанс') && 
               !lower.includes('информация') &&
               !lower.includes('география')
      })
    } else {
      // Для основного файла: ищем "Участник", затем первый неслужебный
      targetSheet = sheets.find(s => s.name.toLowerCase().includes('участник'))
      
      if (!targetSheet) {
        targetSheet = sheets.find(s => {
          const lower = s.name.toLowerCase()
          return !lower.includes('общая') && 
                 !lower.includes('сеанс') && 
                 !lower.includes('информация') &&
                 !lower.includes('география')
        })
      }
    }
    
    if (!targetSheet && sheets.length > 0) {
      targetSheet = sheets[0]
    }
    
    if (!targetSheet) {
      throw new Error('Не найдено ни одного листа с данными в файле')
    }
    
    sheetName = targetSheet.name
    console.log(`📄 Выбран лист для анализа: "${sheetName}"`)
    
    // Теперь нужно перечитать файл и обработать выбранный лист
    const workbookReader2 = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      sharedStrings: 'cache',
      worksheets: 'emit'
    })
    
    for await (const worksheetReader of workbookReader2) {
      // @ts-ignore
      const currentName = worksheetReader.name || 'Unknown'
      
      if (currentName !== sheetName) {
        continue
      }
      
      console.log(`📄 Обработка листа: "${currentName}"`)
      
      let rowNumber = 0
      
      for await (const row of worksheetReader) {
        rowNumber++
        
        // Первая строка - заголовки
        if (rowNumber === 1) {
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const value = cell.value
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              columns.push(String(value).trim())
            } else {
              // Для пустых колонок используем индекс
              columns.push(`[Пустая колонка ${colNumber}]`)
            }
          })
          headerFound = true
          console.log(`📋 Найдено колонок: ${columns.length}`)
        } else {
          // Считаем только строки с данными
          rowCount++
        }
        
        // Показываем прогресс каждые 50000 строк
        if (rowCount > 0 && rowCount % 50000 === 0) {
          console.log(`   Подсчитано строк: ${rowCount.toLocaleString()}`)
        }
      }
      
      break
    }

    if (!headerFound) {
      throw new Error('Не удалось прочитать данные из выбранного листа')
    }

    console.log(`✅ Строк данных: ${rowCount.toLocaleString()}`)
    console.log(`📋 Колонки (${columns.length}):`)
    columns.slice(0, 20).forEach((col, idx) => {
      console.log(`  ${idx + 1}. "${col}"`)
    })
    if (columns.length > 20) {
      console.log(`  ... и ещё ${columns.length - 20} колонок`)
    }
    
    return { columns, rowCount }
  }

  // Импорт больших файлов с маппингом полей (как основной лист с множеством вебинаров)
  async parseBulkFile(filePath: string, mappings: Array<{ excelColumn: string, dbField: string }>) {
    const workbook = XLSX.readFile(filePath)
    
    // Берём первый лист (или первый не "Общая информация")
    const sheetName = workbook.SheetNames.find((name: string) => 
      !name.toLowerCase().includes('общая')
    ) || workbook.SheetNames[0]
    
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet)
    
    console.log(`Bulk импорт: лист "${sheetName}", строк: ${data.length}`)
    
    // Создаём мапу для быстрого доступа к маппингу
    const mappingMap = new Map<string, string>()
    mappings.forEach(m => {
      if (m.dbField) {
        mappingMap.set(m.excelColumn, m.dbField)
      }
    })
    
    console.log('====================================')
    console.log('НАСТРОЕННЫЕ СООТВЕТСТВИЯ:')
    console.log('====================================')
    Array.from(mappingMap.entries()).forEach(([col, field]) => {
      console.log(`  "${col}" → "${field}"`)
    })
    console.log('====================================')
    
    // Выводим первую строку Excel для понимания структуры
    if (data.length > 0) {
      console.log('\nПЕРВАЯ СТРОКА EXCEL (все поля):')
      const firstRow = data[0] as any
      Object.keys(firstRow).forEach(key => {
        console.log(`  "${key}": "${firstRow[key]}"`)
      })
      console.log('====================================\n')
    }
    
    let processedCount = 0
    let skippedCount = 0
    let skippedInnCount = 0
    let skippedNoEmailCount = 0
    let debugRowCount = 0
    
    // Кэш для вебинаров: ключ = "название|дата", значение = webinarId
    const webinarCache = new Map<string, number>()
    
    for (const row of data as any[]) {
      try {
        // Извлекаем значения согласно маппингу
        const mappedData: any = {}
        
        for (const [excelCol, dbField] of mappingMap.entries()) {
          mappedData[dbField] = row[excelCol]
        }
        
        // Выводим первые 3 записи для отладки
        if (debugRowCount < 3) {
          console.log(`\n📋 Запись ${debugRowCount + 1}:`)
          console.log('  Email:', mappedData['Email'])
          console.log('  Имя:', mappedData['Имя'])
          console.log('  Фамилия:', mappedData['Фамилия'])
          console.log('  ИНН_компании:', mappedData['ИНН_компании'], `(тип: ${typeof mappedData['ИНН_компании']})`)
          console.log('  ИНН:', mappedData['ИНН'], `(тип: ${typeof mappedData['ИНН']})`)
          console.log('  Название_компании:', mappedData['Название_компании'])
          console.log('  Вебинар:', mappedData['Вебинар'])
          console.log('  Дата_проведения:', mappedData['Дата_проведения'])
          debugRowCount++
        }
        
        // Пропускаем строки без Email (обязательное поле)
        if (!mappedData['Email']) {
          skippedNoEmailCount++
          if (debugRowCount <= 3) {
            console.log(`❌ Пропущена запись: нет Email`)
          }
          continue
        }
        
        // Валидация ИНН: сначала проверяем "ИНН компании", если пусто - берём "ИНН"
        let innValue = mappedData['ИНН_компании']
        
        if (debugRowCount <= 3) {
          console.log(`\n🔍 Проверка ИНН для записи ${debugRowCount}:`)
          console.log(`  ИНН_компании = "${innValue}" (тип: ${typeof innValue}, пусто: ${!innValue || String(innValue).trim() === ''})`)
        }
        
        // Если ИНН_компании пустой, пробуем ИНН
        if (!innValue || String(innValue).trim() === '') {
          innValue = mappedData['ИНН']
          if (debugRowCount <= 3) {
            console.log(`  ИНН_компании пустой, проверяем ИНН = "${innValue}" (тип: ${typeof innValue})`)
          }
        }
        
        let innStr = ''
        let hasValidInn = false
        
        // Если есть ИНН, проверяем его корректность
        if (innValue && String(innValue).trim() !== '') {
          innStr = String(innValue).trim()
          
          if (debugRowCount <= 3) {
            console.log(`  Проверка формата: "${innStr}" → регулярка: ${/^\d{10}$|^\d{12}$/.test(innStr)}`)
          }
          
          // Проверяем корректность ИНН (только цифры, длина 10 или 12)
          if (/^\d{10}$|^\d{12}$/.test(innStr)) {
            hasValidInn = true
            if (debugRowCount <= 3) {
              console.log(`  ✅ ИНН корректный: ${innStr}`)
            }
          } else {
            if (debugRowCount <= 3 || skippedInnCount < 5) {
              console.log(`  ⚠️ Некорректный ИНН для Email=${mappedData['Email']}: "${innValue}" (должен быть 10 или 12 цифр) - участник будет без компании`)
            }
            skippedInnCount++
            innStr = '' // Пустой ИНН = участник без компании
            hasValidInn = false
          }
        } else {
          if (debugRowCount <= 3 || skippedInnCount < 5) {
            console.log(`  ⚠️ Нет ИНН для Email=${mappedData['Email']} - участник будет без компании`)
          }
          skippedInnCount++
          innStr = '' // Пустой ИНН = участник без компании
          hasValidInn = false
        }
        
        // Обработка вебинара
        let currentWebinarId: number | null = null
        
        if (mappedData['Вебинар'] || mappedData['Дата_проведения']) {
          const webinarName = mappedData['Вебинар'] || 'Импортированный вебинар'
          let webinarDate = mappedData['Дата_проведения'] || new Date().toISOString().split('T')[0]
          
          console.log(`🔍 Обработка вебинара: название="${webinarName}", дата="${webinarDate}" (тип: ${typeof webinarDate})`)
          
          // Нормализуем дату если это Excel serial number
          if (typeof webinarDate === 'number') {
            const date = XLSX.SSF.parse_date_code(webinarDate)
            webinarDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
            console.log(`  📅 Дата преобразована из Excel serial: ${webinarDate}`)
          } else if (webinarDate instanceof Date) {
            webinarDate = webinarDate.toISOString().split('T')[0]
            console.log(`  📅 Дата преобразована из Date: ${webinarDate}`)
          } else if (typeof webinarDate === 'string') {
            const parsed = new Date(webinarDate)
            if (!isNaN(parsed.getTime())) {
              webinarDate = parsed.toISOString().split('T')[0]
              console.log(`  📅 Дата распарсена из строки: ${webinarDate}`)
            }
          }
          
          // Форматируем название с датой
          const dateObj = new Date(webinarDate)
          const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`
          const finalWebinarName = `${webinarName}_${formattedDate}`
          
          console.log(`  ✏️ Финальное название: ${finalWebinarName}`)
          
          // Создаём ключ для кэша
          const cacheKey = `${webinarName}|${webinarDate}`
          
          // Проверяем кэш
          if (webinarCache.has(cacheKey)) {
            currentWebinarId = webinarCache.get(cacheKey)!
            console.log(`  ♻️ Использован кэш: ID ${currentWebinarId}`)
          } else {
            // Проверяем, существует ли вебинар в БД
            const db = databaseService.getDatabase()
            const stmt = db!.prepare('SELECT ID_вебинара FROM Вебинары WHERE Название = ?')
            const existingWebinar = stmt.get(finalWebinarName) as { ID_вебинара: number } | undefined
            
            if (existingWebinar) {
              currentWebinarId = existingWebinar.ID_вебинара
              console.log(`  ✓ Найден в БД: ID ${currentWebinarId}`)
              
              // Обновляем дату существующего вебинара
              if (webinarDate) {
                db!.prepare('UPDATE Вебинары SET Дата = ? WHERE ID_вебинара = ?').run(webinarDate, currentWebinarId)
                console.log(`  ♻️ Обновлена дата вебинара: ${webinarDate}`)
              }
            } else {
              currentWebinarId = databaseService.createWebinar(finalWebinarName, webinarDate) as number
              console.log(`  ✨ Создан новый: ID ${currentWebinarId}`)
              
              // Обрабатываем теги если они есть
              if (mappedData['Теги']) {
                const tagsStr = String(mappedData['Теги']).trim()
                if (tagsStr) {
                  // Разделяем теги по запятой, точке с запятой, | или переносу строки
                  // Убираем пустые строки и лишние пробелы
                  const tags = tagsStr
                    .split(/[,;|\n\r]+/)
                    .map(t => t.trim())
                    .filter(t => t.length > 0)
                  
                  console.log(`  🏷️ Обработка тегов для вебинара ${currentWebinarId}:`)
                  console.log(`    Исходная строка: "${tagsStr}"`)
                  console.log(`    Распарсено тегов: ${tags.length}`)
                  tags.forEach((tag, idx) => {
                    console.log(`    Тег ${idx + 1}: "${tag}"`)
                  })
                  
                  let linkedCount = 0
                  for (const tagName of tags) {
                    const tagId = databaseService.findTag(tagName)
                    if (tagId) {
                      databaseService.linkWebinarTag(currentWebinarId, tagId)
                      linkedCount++
                    }
                  }
                  
                  console.log(`  📊 Итого привязано тегов: ${linkedCount} из ${tags.length}`)
                }
              }
            }
            
            // Если вебинар уже существовал и есть теги, обрабатываем их
            if (existingWebinar && mappedData['Теги']) {
              const tagsStr = String(mappedData['Теги']).trim()
              if (tagsStr) {
                const tags = tagsStr
                  .split(/[,;|\n\r]+/)
                  .map(t => t.trim())
                  .filter(t => t.length > 0)
                
                console.log(`  🏷️ Обработка тегов для существующего вебинара ${currentWebinarId}:`)
                console.log(`    Исходная строка: "${tagsStr}"`)
                console.log(`    Распарсено тегов: ${tags.length}`)
                
                let linkedCount = 0
                for (const tagName of tags) {
                  const tagId = databaseService.findTag(tagName)
                  if (tagId) {
                    // Используем INSERT OR IGNORE чтобы не дублировать теги
                    databaseService.linkWebinarTag(currentWebinarId, tagId)
                    linkedCount++
                  }
                }
                
                console.log(`  📊 Итого привязано тегов: ${linkedCount} из ${tags.length}`)
              }
            }
            
            // Сохраняем в кэш
            webinarCache.set(cacheKey, currentWebinarId)
          }
        } else {
          console.log(`⚠️ Нет данных о вебинаре для Email=${mappedData['Email']}`)
        }
        
        // Обработка номера телефона
        let phoneNumber = mappedData['Телефон']
        if (phoneNumber) {
          if (typeof phoneNumber === 'number') {
            phoneNumber = String(phoneNumber)
          } else {
            phoneNumber = String(phoneNumber).trim()
          }
          
          phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '')
          
          if (phoneNumber.startsWith('8') && phoneNumber.length === 11) {
            phoneNumber = '+7' + phoneNumber.slice(1)
          }
          
          if (phoneNumber.startsWith('7') && phoneNumber.length === 11 && !phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber
          }
          
          if (phoneNumber.startsWith('+7') && phoneNumber.length === 12) {
            phoneNumber = `${phoneNumber.slice(0, 2)} ${phoneNumber.slice(2, 5)} ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8, 10)}-${phoneNumber.slice(10, 12)}`
          }
        }
        
        // Создаём или находим участника по email (email - уникальный идентификатор)
        const participantId = databaseService.getOrCreateParticipantByEmail(
          mappedData['Email'],
          mappedData['Имя'] || '',
          mappedData['Фамилия'] || '',
          innStr, // Может быть пустой строкой если ИНН некорректный
          phoneNumber || null,
          mappedData['Название_компании'] || mappedData['Компания_чат'] || null,
          undefined // должность берём из других источников
        )
        
        // Если есть вебинар, связываем участника с вебинаром
        if (currentWebinarId) {
          databaseService.addParticipantWebinar(participantId, currentWebinarId, {
            chatName: mappedData['Имя_в_чате'] || null,
            company: mappedData['Компания_чат'] || null,
            registrationStatus: mappedData['Статус_регистрации'] || null,
            registrationDate: mappedData['Дата_регистрации'] || null,
            sources: mappedData['Источники'] || null,
            utmSource: mappedData['utm_source'] || null,
            utmMedium: mappedData['utm_medium'] || null,
            utmCampaign: mappedData['utm_campaign'] || null,
            utmContent: mappedData['utm_content'] || null,
            utmTerm: mappedData['utm_term'] || null,
            utmCustom: mappedData['utm_custom'] || null,
            platform: mappedData['Платформа'] || null,
            country: mappedData['Страна'] || null,
            city: mappedData['Город'] || null,
            lastIP: mappedData['Последний_IP'] || null,
            firstEntry: mappedData['Время_входа_первое'] || null,
            lastExit: mappedData['Время_выхода_последнее'] || null,
            attendanceDuration: mappedData['Присутствие_относительно_длительности'] || null,
            attendancePercent: mappedData['Присутствие_от_общей_длительности'] || null,
            messagesCount: mappedData['Кол_во_сообщений'] || 0,
            messagesPercent: mappedData['Процент_от_общего_кол_ва_сообщений'] || null,
            questionsCount: mappedData['Кол_во_вопросов'] || 0,
            questionsPercent: mappedData['Процент_от_общего_кол_ва_вопросов'] || null,
            handsRaised: mappedData['Количество_поднятых_рук'] || 0,
            emojiReactions: mappedData['Количество_отправленных_эмодзи_реакций'] || 0
          })
        }
        
        processedCount++
      } catch (error) {
        console.error('Ошибка при обработке строки:', error)
        skippedCount++
      }
    }
    
    console.log('\n====================================')
    console.log('РЕЗУЛЬТАТЫ ИМПОРТА:')
    console.log('====================================')
    console.log(`✅ Импортировано записей: ${processedCount}`)
    console.log(`📊 Создано/обновлено вебинаров: ${webinarCache.size}`)
    if (skippedNoEmailCount > 0) {
      console.log(`⚠️ Пропущено записей без Email: ${skippedNoEmailCount}`)
    }
    if (skippedInnCount > 0) {
      console.log(`⚠️ Записей с некорректным/отсутствующим ИНН (использована заглушка): ${skippedInnCount}`)
    }
    if (skippedCount > 0) {
      console.log(`❌ Пропущено записей с ошибками: ${skippedCount}`)
    }
    console.log('====================================\n')
  }

  // Универсальный парсер с маппингом
  async parseFileWithMapping(
    filePath: string,
    webinarId: number,
    mapping: Record<string, string>,
    format: 'mts' | 'proofix',
    importPositions: boolean = false
  ) {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames.find((name: string) => 
      !name.toLowerCase().includes('общая')
    ) || workbook.SheetNames[0]
    
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг файла с маппингом: лист "${sheetName}", строк: ${data.length}`)
    console.log('Маппинг полей:', mapping)

    let processedCount = 0
    let skippedInnCount = 0
    let skippedNoEmailCount = 0

    for (const row of data as any[]) {
      try {
        // Извлекаем значения согласно маппингу
        const mappedData: any = {}
        
        for (const [dbField, excelCol] of Object.entries(mapping)) {
          if (excelCol && row[excelCol] !== undefined) {
            mappedData[dbField] = row[excelCol]
          }
        }

        // Пропускаем строки без Email
        if (!mappedData['Email']) {
          skippedNoEmailCount++
          continue
        }

        // Валидация ИНН
        let innValue = mappedData['ИНН_компании'] || mappedData['ИНН']
        let innStr = ''
        
        if (innValue && String(innValue).trim() !== '') {
          innStr = String(innValue).trim()
          
          if (!/^\d{10}$|^\d{12}$/.test(innStr)) {
            skippedInnCount++
            innStr = ''
          }
        } else {
          skippedInnCount++
          innStr = ''
        }

        // Обработка телефона
        let phoneNumber = mappedData['Телефон']
        if (phoneNumber) {
          if (typeof phoneNumber === 'number') {
            phoneNumber = String(phoneNumber)
          } else {
            phoneNumber = String(phoneNumber).trim()
          }
          
          phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '')
          
          if (phoneNumber.startsWith('8') && phoneNumber.length === 11) {
            phoneNumber = '+7' + phoneNumber.slice(1)
          }
          
          if (phoneNumber.startsWith('7') && phoneNumber.length === 11 && !phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber
          }
          
          if (phoneNumber.startsWith('+7') && phoneNumber.length === 12) {
            phoneNumber = `${phoneNumber.slice(0, 2)} ${phoneNumber.slice(2, 5)} ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8, 10)}-${phoneNumber.slice(10, 12)}`
          }
        }

        // Парсим UTM метки для Proofix
        let utmParams = {
          utm_source: null as string | null,
          utm_medium: null as string | null,
          utm_campaign: null as string | null,
          utm_content: null as string | null,
          utm_term: null as string | null,
          utm_custom: null as string | null
        }
        
        if (format === 'proofix' && mappedData['Utm_метки']) {
          utmParams = this.parseProofixUtm(mappedData['Utm_метки'])
        } else {
          utmParams.utm_source = mappedData['utm_source'] || null
          utmParams.utm_medium = mappedData['utm_medium'] || null
          utmParams.utm_campaign = mappedData['utm_campaign'] || null
          utmParams.utm_content = mappedData['utm_content'] || null
          utmParams.utm_term = mappedData['utm_term'] || null
          utmParams.utm_custom = mappedData['utm_custom'] || null
        }

        // Конвертация времени для Proofix
        let attendanceDuration = null
        if (format === 'proofix' && mappedData['Продолжительность_присутствия']) {
          attendanceDuration = this.minutesToHHMMSS(mappedData['Продолжительность_присутствия'])
        } else {
          attendanceDuration = mappedData['Присутствие_относительно_длительности'] || null
        }

        // Создаём участника
        const participantId = databaseService.getOrCreateParticipantByEmail(
          mappedData['Email'],
          mappedData['Имя'] || '',
          mappedData['Фамилия'] || '',
          innStr,
          phoneNumber || null,
          mappedData['Компания'] || undefined,
          mappedData['Должность'] || undefined
        )

        // Добавляем связь участник-вебинар
        databaseService.addParticipantWebinar(participantId, webinarId, {
          chatName: mappedData['Имя_в_чате'] || null,
          company: mappedData['Компания'] || null,
          registrationStatus: mappedData['Статус_регистрации'] || (format === 'proofix' ? 'Зарегистрирован' : null),
          registrationDate: mappedData['Дата_регистрации'] || mappedData['Дата_создания'] || null,
          sources: mappedData['Источники'] || mappedData['Источник'] || null,
          utmSource: utmParams.utm_source,
          utmMedium: utmParams.utm_medium,
          utmCampaign: utmParams.utm_campaign,
          utmContent: utmParams.utm_content,
          utmTerm: utmParams.utm_term,
          utmCustom: utmParams.utm_custom,
          platform: mappedData['Платформа'] || null,
          country: mappedData['Страна'] || null,
          city: mappedData['Город'] || null,
          lastIP: mappedData['Последний_IP'] || null,
          firstEntry: mappedData['Время_входа'] || null,
          lastExit: mappedData['Время_выхода'] || null,
          attendanceDuration: attendanceDuration,
          attendancePercent: mappedData['Присутствие_от_общей_длительности'] || null,
          messagesCount: mappedData['Кол_во_сообщений'] || 0,
          messagesPercent: mappedData['Процент_сообщений'] || null,
          questionsCount: mappedData['Кол_во_вопросов'] || 0,
          questionsPercent: mappedData['Процент_вопросов'] || null,
          handsRaised: mappedData['Поднятые_руки'] || 0,
          emojiReactions: mappedData['Эмодзи_реакции'] || 0
        })
        
        processedCount++
      } catch (error) {
        console.error('Ошибка при обработке строки:', error)
      }
    }
    
    console.log(`✅ Импортировано записей: ${processedCount} из ${data.length}`)
    if (skippedNoEmailCount > 0) {
      console.log(`⚠️ Пропущено записей без Email: ${skippedNoEmailCount}`)
    }
    if (skippedInnCount > 0) {
      console.log(`⚠️ Записей с некорректным/отсутствующим ИНН: ${skippedInnCount}`)
    }
  }

  // ПОТОКОВАЯ ВЕРСИЯ: Импорт больших файлов с использованием exceljs для минимального потребления памяти
  async parseBulkFileStreaming(
    filePath: string, 
    mappings: Array<{ excelColumn: string, dbField: string }>,
    progressCallback?: (processed: number, total: number) => void
  ) {
    const startTime = Date.now()
    
    console.log('\n' + '='.repeat(70))
    console.log('🚀 ЗАПУСК ПОТОКОВОГО ИМПОРТА БОЛЬШИХ ДАННЫХ')
    console.log('='.repeat(70))
    console.log(`📂 Файл: ${filePath}`)
    console.log(`⏰ Время старта: ${new Date().toLocaleTimeString('ru-RU')}`)
    
    // Создаём мапу для быстрого доступа к маппингу
    const mappingMap = new Map<string, string>()
    mappings.forEach(m => {
      if (m.dbField) {
        mappingMap.set(m.excelColumn, m.dbField)
      }
    })
    
    console.log('\n' + '-'.repeat(70))
    console.log('📋 НАСТРОЕННЫЕ СООТВЕТСТВИЯ:')
    console.log('-'.repeat(70))
    Array.from(mappingMap.entries()).forEach(([col, field]) => {
      console.log(`  "${col}" → "${field}"`)
    })
    console.log('-'.repeat(70) + '\n')

    console.log('⚙️  Инициализация потокового чтения...')
    
    // Предзагрузка существующих вебинаров в кэш для ускорения
    console.log('📦 Загрузка существующих вебинаров в кэш...')
    const webinarCache = new Map<string, number>()
    const db = databaseService.getDatabase()
    
    try {
      const existingWebinars = db!.prepare('SELECT ID_вебинара, Название, Дата FROM Вебинары').all() as { ID_вебинара: number, Название: string, Дата: string }[]
      if (existingWebinars.length > 0) {
        for (const row of existingWebinars) {
          const id = row.ID_вебинара
          const name = row.Название
          const date = row.Дата
          
          // Извлекаем оригинальное название и дату из форматированного названия
          // Формат: "Название_DD.MM.YYYY"
          const match = name.match(/^(.+)_(\d{2}\.\d{2}\.\d{4})$/)
          if (match) {
            const originalName = match[1]
            const dateStr = match[2]
            // Конвертируем DD.MM.YYYY в YYYY-MM-DD
            const [day, month, year] = dateStr.split('.')
            const isoDate = `${year}-${month}-${day}`
            const cacheKey = `${originalName}|${isoDate}`
            webinarCache.set(cacheKey, id)
          }
        }
        console.log(`✅ Загружено ${webinarCache.size} вебинаров в кэш`)
      }
    } catch (cacheError) {
      console.log(`⚠️  Не удалось загрузить вебинары в кэш: ${cacheError}`)
    }
    
    let processedCount = 0
    let skippedCount = 0
    let skippedInnCount = 0
    let skippedNoEmailCount = 0
    let debugRowCount = 0
    let totalRows = 0
    let headerColumns: string[] = []

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      sharedStrings: 'cache',
      hyperlinks: 'cache',
      styles: 'cache',
      worksheets: 'emit'
    })

    console.log('✓ Файл открыт для потокового чтения\n')

    // Сначала собираем все листы для определения стратегии
    const allSheets: Array<{ name: string, reader: any }> = []
    for await (const worksheetReader of workbookReader) {
      // @ts-ignore
      const sheetName = worksheetReader.name || 'Unknown'
      allSheets.push({ name: sheetName, reader: worksheetReader })
    }
    
    console.log(`📋 Всего листов в файле: ${allSheets.length}`)
    allSheets.forEach(s => console.log(`  - "${s.name}"`))
    
    // Определяем, какой лист обрабатывать
    let targetSheet: { name: string, reader: any } | null = null
    
    if (allSheets.length === 1) {
      // Если только один лист - обрабатываем его
      targetSheet = allSheets[0]
      console.log(`✓ Один лист в файле, обрабатываем: "${targetSheet.name}"`)
    } else {
      // Если несколько листов - ищем "Участники" или первый неслужебный
      targetSheet = allSheets.find(s => s.name.toLowerCase().includes('участник')) || null
      
      if (!targetSheet) {
        // Берём первый неслужебный лист
        targetSheet = allSheets.find(s => {
          const lower = s.name.toLowerCase()
          return !lower.includes('общая') && 
                 !lower.includes('информация') &&
                 !lower.includes('география') &&
                 !lower.includes('сеанс')
        }) || null
      }
      
      if (targetSheet) {
        console.log(`✓ Выбран лист для обработки: "${targetSheet.name}"`)
      }
    }
    
    if (!targetSheet) {
      throw new Error('Не найден подходящий лист для обработки')
    }

    // Теперь обрабатываем выбранный лист
    // Нужно перечитать файл, так как ExcelJS не позволяет повторно использовать reader
    console.log('\n⚙️  Открываем файл для обработки выбранного листа...\n')
    
    const workbookReader2 = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      sharedStrings: 'cache',
      hyperlinks: 'cache',
      styles: 'cache',
      worksheets: 'emit'
    })
    
    for await (const worksheetReader of workbookReader2) {
      // @ts-ignore
      const sheetName = worksheetReader.name || 'Unknown'
      
      // Обрабатываем только выбранный лист
      if (sheetName !== targetSheet.name) {
        console.log(`⏭️  Пропущен лист: "${sheetName}"`)
        continue
      }
      
      console.log('📊 НАЧАЛО ОБРАБОТКИ ЛИСТА: "' + sheetName + '"')
      console.log('-'.repeat(70))
      
      let rowNumber = 0
      let lastProgressTime = Date.now()

      for await (const row of worksheetReader) {
        rowNumber++
        
        // Первая строка - заголовки
        if (rowNumber === 1) {
          row.eachCell({ includeEmpty: true }, (cell) => {
            const value = cell.value
            headerColumns.push(value ? String(value) : '')
          })
          
          console.log(`📋 Найдено колонок: ${headerColumns.length}`)
          if (debugRowCount === 0) {
            console.log('   Первые 10 колонок:')
            headerColumns.slice(0, 10).forEach((col, idx) => {
              console.log(`      ${idx + 1}. "${col}"`)
            })
            console.log('')
            console.log('🔄 Начинаем обработку строк данных...')
            console.log('-'.repeat(70))
          }
          continue
        }
        
        totalRows++
        
        // Периодическое сохранение БД для предотвращения переполнения памяти
        if (totalRows % 1000 === 0) {
          console.log(`   💾 Промежуточное сохранение БД (${totalRows.toLocaleString()} строк)...`)
          try {
            databaseService.saveDatabase()
            console.log(`   ✓ Сохранено успешно`)
          } catch (saveError) {
            console.error(`   ⚠️ Ошибка сохранения: ${saveError}`)
            // Продолжаем импорт даже если сохранение не удалось
          }
        }
        
        // Показываем прогресс каждые 5000 строк с временем
        if (totalRows % 5000 === 0) {
          const currentTime = Date.now()
          const elapsed = ((currentTime - startTime) / 1000).toFixed(1)
          const rate = Math.round(totalRows / (currentTime - startTime) * 1000)
          console.log(`   ⚡ Обработано: ${totalRows.toLocaleString()} строк | Время: ${elapsed}с | Скорость: ${rate} строк/сек`)
          lastProgressTime = currentTime
          
          if (progressCallback) {
            progressCallback(totalRows, -1)
          }
        }

        try {
          // Извлекаем значения из строки
          const rowData: any = {}
          let colIndex = 0
          
          row.eachCell({ includeEmpty: true }, (cell) => {
            if (colIndex < headerColumns.length) {
              const columnName = headerColumns[colIndex]
              let cellValue = cell.value
              
              // ИСПРАВЛЕНИЕ: Конвертируем Date объекты в строки для sql.js
              if (cellValue instanceof Date) {
                cellValue = cellValue.toISOString().split('T')[0]
              }
              // Конвертируем Excel serial dates
              else if (typeof cellValue === 'number' && columnName.toLowerCase().includes('дата')) {
                try {
                  const date = XLSX.SSF.parse_date_code(cellValue)
                  cellValue = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
                } catch (e) {
                  // Если не дата, оставляем как число
                }
              }
              
              rowData[columnName] = cellValue
            }
            colIndex++
          })

          // Маппим данные согласно настройкам
          const mappedData: any = {}
          for (const [excelCol, dbField] of mappingMap.entries()) {
            mappedData[dbField] = rowData[excelCol]
          }

          // Отладка первых 3 записей
          if (debugRowCount < 3) {
            console.log(`\n📋 Запись ${debugRowCount + 1}:`)
            console.log('  Email:', mappedData['Email'])
            console.log('  Имя:', mappedData['Имя'])
            console.log('  Фамилия:', mappedData['Фамилия'])
            console.log('  ИНН_компании:', mappedData['ИНН_компании'])
            console.log('  ИНН:', mappedData['ИНН'])
            console.log('  Вебинар:', mappedData['Вебинар'])
            console.log('  Дата_проведения:', mappedData['Дата_проведения'])
            debugRowCount++
          }

          // Пропускаем строки без Email
          if (!mappedData['Email']) {
            skippedNoEmailCount++
            continue
          }

          // УЛУЧШЕННАЯ валидация ИНН с поддержкой дубликатов колонок
          // Ищем первый непустой валидный ИНН из всех возможных колонок
          let innValue = null
          
          // Проверяем ИНН_компании (приоритет 1)
          if (mappedData['ИНН_компании']) {
            innValue = mappedData['ИНН_компании']
          }
          
          // Если нет, проверяем ИНН (приоритет 2)
          if ((!innValue || String(innValue).trim() === '') && mappedData['ИНН']) {
            innValue = mappedData['ИНН']
          }

          let innStr = ''
          let hasValidInn = false

          if (innValue && String(innValue).trim() !== '') {
            innStr = String(innValue).trim()
            
            // Удаляем нечисловые символы если есть
            innStr = innStr.replace(/[^\d]/g, '')
            if (/^\d{10}$|^\d{12}$/.test(innStr)) {
              hasValidInn = true
            } else {
              if (skippedInnCount < 5) {
                console.log(`  ⚠️ Некорректный ИНН: "${innValue}"`)
              }
              skippedInnCount++
              innStr = ''
            }
          } else {
            if (skippedInnCount < 5) {
              console.log(`  ⚠️ Нет ИНН для Email=${mappedData['Email']}`)
            }
            skippedInnCount++
          }

          // Обработка вебинара с ограничением на создание новых
          let currentWebinarId: number | null = null

          if (mappedData['Вебинар'] || mappedData['Дата_проведения']) {
            const webinarName = mappedData['Вебинар'] || 'Импортированный вебинар'
            let webinarDate = mappedData['Дата_проведения'] || new Date().toISOString().split('T')[0]

            // Нормализуем дату
            if (typeof webinarDate === 'number') {
              const date = XLSX.SSF.parse_date_code(webinarDate)
              webinarDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
            } else if (webinarDate instanceof Date) {
              webinarDate = webinarDate.toISOString().split('T')[0]
            } else if (typeof webinarDate === 'string') {
              const parsed = new Date(webinarDate)
              if (!isNaN(parsed.getTime())) {
                webinarDate = parsed.toISOString().split('T')[0]
              }
            }

            const dateObj = new Date(webinarDate)
            const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`
            const finalWebinarName = `${webinarName}_${formattedDate}`
            const cacheKey = `${webinarName}|${webinarDate}`

            // Проверяем кэш
            if (webinarCache.has(cacheKey)) {
              currentWebinarId = webinarCache.get(cacheKey)!
            } else {
              // Создаём новый вебинар
              try {
                currentWebinarId = databaseService.createWebinar(finalWebinarName, webinarDate) as number
                
                // Обрабатываем теги
                if (mappedData['Теги']) {
                  const tagsStr = String(mappedData['Теги']).trim()
                  if (tagsStr) {
                    const tags = tagsStr.split(/[,;|\n\r]+/).map(t => t.trim()).filter(t => t.length > 0)
                    for (const tagName of tags) {
                      const tagId = databaseService.findTag(tagName)
                      if (tagId) {
                        databaseService.linkWebinarTag(currentWebinarId, tagId)
                      }
                    }
                  }
                }

                webinarCache.set(cacheKey, currentWebinarId)
              } catch (webinarError) {
                console.error(`   ⚠️ Ошибка создания вебинара: ${webinarError}`)
                currentWebinarId = null
              }
            }
          }
          if (mappedData['Вебинар'] || mappedData['Дата_проведения']) {
            const webinarName = mappedData['Вебинар'] || 'Импортированный вебинар'
            let webinarDate = mappedData['Дата_проведения'] || new Date().toISOString().split('T')[0]

            // Нормализуем дату если это Excel serial number
            if (typeof webinarDate === 'number') {
              const date = XLSX.SSF.parse_date_code(webinarDate)
              webinarDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
            } else if (webinarDate instanceof Date) {
              webinarDate = webinarDate.toISOString().split('T')[0]
            } else if (typeof webinarDate === 'string') {
              const parsed = new Date(webinarDate)
              if (!isNaN(parsed.getTime())) {
                webinarDate = parsed.toISOString().split('T')[0]
              }
            }

            // Форматируем название с датой
            const dateObj = new Date(webinarDate)
            const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`
            const finalWebinarName = `${webinarName}_${formattedDate}`

            const cacheKey = `${webinarName}|${webinarDate}`

            // Проверяем кэш
            if (webinarCache.has(cacheKey)) {
              currentWebinarId = webinarCache.get(cacheKey)!
            } else {
              // Вебинар не найден в кэше - создаём новый без проверки БД
              try {
                currentWebinarId = databaseService.createWebinar(finalWebinarName, webinarDate) as number
                
                // Обрабатываем теги если есть
                if (mappedData['Теги']) {
                  const tagsStr = String(mappedData['Теги']).trim()
                  if (tagsStr) {
                    const tags = tagsStr
                      .split(/[,;|\n\r]+/)
                      .map(t => t.trim())
                      .filter(t => t.length > 0)

                    for (const tagName of tags) {
                      const tagId = databaseService.findTag(tagName)
                      if (tagId) {
                        databaseService.linkWebinarTag(currentWebinarId, tagId)
                      }
                    }
                  }
                }

                // Сохраняем в кэш
                webinarCache.set(cacheKey, currentWebinarId)

              webinarCache.set(cacheKey, currentWebinarId)
              } catch (webinarError) {
                console.error(`   ⚠️ Ошибка при создании/поиске вебинара: ${webinarError}`)
                currentWebinarId = null
              }
            }
          }

          // Обработка телефона
          let phoneNumber = mappedData['Телефон']
          if (phoneNumber) {
            if (typeof phoneNumber === 'number') {
              phoneNumber = String(phoneNumber)
            } else {
              phoneNumber = String(phoneNumber).trim()
            }

            phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '')

            if (phoneNumber.startsWith('8') && phoneNumber.length === 11) {
              phoneNumber = '+7' + phoneNumber.slice(1)
            }

            if (phoneNumber.startsWith('7') && phoneNumber.length === 11 && !phoneNumber.startsWith('+')) {
              phoneNumber = '+' + phoneNumber
            }

            if (phoneNumber.startsWith('+7') && phoneNumber.length === 12) {
              phoneNumber = `${phoneNumber.slice(0, 2)} ${phoneNumber.slice(2, 5)} ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8, 10)}-${phoneNumber.slice(10, 12)}`
            }
          }

          // Валидация и очистка данных перед передачей в БД
          const cleanEmail = String(mappedData['Email'] || '').trim()
          const cleanFirstName = String(mappedData['Имя'] || '').trim()
          const cleanLastName = String(mappedData['Фамилия'] || '').trim()
          const cleanCompanyName = String(mappedData['Название_компании'] || mappedData['Компания_чат'] || '').trim()

          // Создаём участника с обработкой ошибок
          try {
            const participantId = databaseService.getOrCreateParticipantByEmail(
              cleanEmail,
              cleanFirstName,
              cleanLastName,
              innStr,
              phoneNumber || undefined,
              cleanCompanyName || undefined,
              undefined
            )

            // Связываем с вебинаром ТОЛЬКО если есть и участник И вебинар
            if (participantId && currentWebinarId) {
              // Конвертируем все даты в строки
              let regDate = mappedData['Дата_регистрации']
              if (regDate instanceof Date) {
                regDate = regDate.toISOString().split('T')[0]
              } else if (typeof regDate === 'number') {
                try {
                  const d = XLSX.SSF.parse_date_code(regDate)
                  regDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
                } catch (e) {
                  regDate = null
                }
              }

              databaseService.addParticipantWebinar(participantId, currentWebinarId, {
                chatName: String(mappedData['Имя_в_чате'] || '').trim() || null,
                company: String(mappedData['Компания_чат'] || '').trim() || null,
                registrationStatus: String(mappedData['Статус_регистрации'] || '').trim() || null,
                registrationDate: regDate,
                sources: String(mappedData['Источники'] || '').trim() || null,
                utmSource: String(mappedData['utm_source'] || '').trim() || null,
                utmMedium: String(mappedData['utm_medium'] || '').trim() || null,
                utmCampaign: String(mappedData['utm_campaign'] || '').trim() || null,
                utmContent: String(mappedData['utm_content'] || '').trim() || null,
                utmTerm: String(mappedData['utm_term'] || '').trim() || null,
                utmCustom: String(mappedData['utm_custom'] || '').trim() || null,
                platform: String(mappedData['Платформа'] || '').trim() || null,
                country: String(mappedData['Страна'] || '').trim() || null,
                city: String(mappedData['Город'] || '').trim() || null,
                lastIP: String(mappedData['Последний_IP'] || '').trim() || null,
                firstEntry: mappedData['Время_входа_первое'] || null,
                lastExit: mappedData['Время_выхода_последнее'] || null,
                attendanceDuration: mappedData['Присутствие_относительно_длительности'] || null,
                attendancePercent: mappedData['Присутствие_от_общей_длительности'] || null,
                messagesCount: Number(mappedData['Кол_во_сообщений']) || 0,
                messagesPercent: mappedData['Процент_сообщений'] || null,
                questionsCount: Number(mappedData['Кол_во_вопросов']) || 0,
                questionsPercent: mappedData['Процент_вопросов'] || null,
                handsRaised: Number(mappedData['Поднятые_руки']) || 0,
                emojiReactions: Number(mappedData['Эмодзи_реакции']) || 0
              })
            }

            processedCount++
          } catch (dbError) {
            // Логируем ошибку БД но продолжаем обработку
            if (processedCount < 5) {
              console.error(`   ❌ Ошибка БД для записи ${totalRows}:`, dbError)
              console.error(`      Email: ${cleanEmail}`)
            }
          }
        } catch (error) {
          console.error('Ошибка при обработке строки:', error)
        }
      }
    }

    const endTime = Date.now()
    const totalTime = ((endTime - startTime) / 1000).toFixed(1)
    const avgRate = Math.round(totalRows / (endTime - startTime) * 1000)
    
    console.log('\n' + '='.repeat(70))
    console.log('✅ ИМПОРТ ЗАВЕРШЁН УСПЕШНО')
    console.log('='.repeat(70))
    console.log(`⏰ Время завершения: ${new Date().toLocaleTimeString('ru-RU')}`)
    console.log(`⏱️  Общее время: ${totalTime} секунд`)
    console.log(`⚡ Средняя скорость: ${avgRate} строк/сек`)
    console.log('')
    console.log('📊 СТАТИСТИКА:')
    console.log('-'.repeat(70))
    console.log(`   • Всего строк обработано: ${totalRows.toLocaleString()}`)
    console.log(`   • Импортировано успешно: ${processedCount.toLocaleString()} (${Math.round(processedCount / totalRows * 100)}%)`)
    if (skippedNoEmailCount > 0) {
      console.log(`   • Пропущено без Email: ${skippedNoEmailCount.toLocaleString()}`)
    }
    if (skippedInnCount > 0) {
      console.log(`   • С некорректным ИНН: ${skippedInnCount.toLocaleString()}`)
    }
    console.log(`   • Уникальных вебинаров: ${webinarCache.size}`)
    console.log('='.repeat(70) + '\n')
    
    if (progressCallback) {
      progressCallback(processedCount, totalRows)
    }
  }
}

export default new ParserService()

