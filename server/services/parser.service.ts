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
          row['Компания'],
          row['Должность'] || null
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

  // Парсинг файла с опросами
  async parseSurveyFile(filePath: string, webinarId: number | null, importPositions: boolean = false) {
    const workbook = XLSX.readFile(filePath)
    
    // Ищем лист "Ответы"
    const surveySheetName = workbook.SheetNames.find((name: string) => 
      name.toLowerCase().includes('ответ')
    )
    
    if (!surveySheetName) {
      throw new Error('Лист "Ответы" не найден в файле')
    }
    
    const sheet = workbook.Sheets[surveySheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Парсинг опросов: лист "${surveySheetName}", строк: ${data.length}`)
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
        const emailResult = db!.exec('SELECT e.ID_email, e.ID_участника FROM Email e WHERE e.Email = ?', [email])

        if (emailResult.length > 0 && emailResult[0].values.length > 0) {
          const emailId = emailResult[0].values[0][0] as number
          const participantId = emailResult[0].values[0][1] as number
          
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

  // Прочитать колонки из Excel файла
  async readExcelColumns(filePath: string): Promise<{ columns: string[], rowCount: number }> {
    const workbook = XLSX.readFile(filePath)
    
    console.log('📂 Листы в файле:', workbook.SheetNames)
    
    // Берём первый лист (или первый не "Общая информация")
    const sheetName = workbook.SheetNames.find((name: string) => 
      !name.toLowerCase().includes('общая')
    ) || workbook.SheetNames[0]
    
    console.log('📄 Выбран лист:', sheetName)
    
    const sheet = workbook.Sheets[sheetName]
    
    // Получаем диапазон листа
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    
    // Читаем ВСЕ колонки из первой строки (включая пустые)
    const columns: string[] = []
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      const cell = sheet[cellAddress]
      
      // Если ячейка существует и имеет значение - берем его
      // Если пустая - используем адрес колонки (A, B, C, ...)
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        columns.push(String(cell.v).trim())
      } else {
        // Для пустых колонок используем букву колонки
        const colLetter = XLSX.utils.encode_col(col)
        columns.push(`[Пустая колонка ${colLetter}]`)
      }
    }
    
    // Считаем количество строк с данными
    const data = XLSX.utils.sheet_to_json(sheet)
    const rowCount = data.length
    
    console.log('📊 Строк данных:', rowCount)
    console.log('📋 ВСЕ КОЛОНКИ ИЗ EXCEL (включая пустые, всего:', columns.length, '):')
    columns.forEach((col, idx) => {
      console.log(`  ${idx + 1}. "${col}"`)
    })
    
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
              console.log(`  ⚠️ Некорректный ИНН для Email=${mappedData['Email']}: "${innValue}" (должен быть 10 или 12 цифр)`)
            }
            skippedInnCount++
            innStr = '0000000000' // Временный ИНН-заглушка
          }
        } else {
          if (debugRowCount <= 3 || skippedInnCount < 5) {
            console.log(`  ⚠️ Нет ИНН для Email=${mappedData['Email']}, использую заглушку`)
          }
          skippedInnCount++
          innStr = '0000000000' // Временный ИНН-заглушка
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
            const existingWebinar = db!.exec(
              'SELECT ID_вебинара FROM Вебинары WHERE Название = ?',
              [finalWebinarName]
            )
            
            if (existingWebinar.length > 0 && existingWebinar[0].values.length > 0) {
              currentWebinarId = existingWebinar[0].values[0][0] as number
              console.log(`  ✓ Найден в БД: ID ${currentWebinarId}`)
            } else {
              currentWebinarId = databaseService.createWebinar(finalWebinarName, webinarDate) as number
              console.log(`  ✨ Создан новый: ID ${currentWebinarId}`)
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
        
        // Создаём или находим участника
        const participantId = databaseService.getOrCreateParticipant(
          mappedData['Имя'] || '',
          mappedData['Фамилия'] || '',
          innStr,
          phoneNumber || null,
          mappedData['Название_компании'] || mappedData['Компания_чат'] || null,
          undefined // должность берём из других источников
        )
        
        // Добавляем email
        const emailId = databaseService.getOrCreateEmail(mappedData['Email'], participantId)
        
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
}

export default new ParserService()
