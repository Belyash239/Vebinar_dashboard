import express from 'express'
import cors from 'cors'
import multer from 'multer'
import databaseService from './database/database.service.js'
import parserService from './services/parser.service.js'
import exportService from './services/export.service.js'

const app = express()
const PORT = 3000

// Инициализация БД
await databaseService.init()

// Middleware
app.use(cors())
app.use(express.json())

// Настройка multer для загрузки файлов
const upload = multer({ dest: 'uploads/' })

// Получить статистику
app.get('/api/stats', (req, res) => {
  try {
    const stats = databaseService.getStats()
    res.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Получить топ-20 компаний с более 5 сотрудниками
app.get('/api/top-companies', (req, res) => {
  try {
    const companies = databaseService.getTopCompaniesWithEmployees()
    res.json(companies)
  } catch (error) {
    console.error('Error fetching top companies:', error)
    res.status(500).json({ error: 'Failed to fetch top companies' })
  }
})

// Получить топ вебинаров по посещениям
app.get('/api/top-webinars', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const sortBy = (req.query.sortBy as string) || 'attended'
    const webinars = databaseService.getTopWebinarsByAttendance(limit, sortBy)
    res.json(webinars)
  } catch (error) {
    console.error('Error fetching top webinars:', error)
    res.status(500).json({ error: 'Failed to fetch top webinars' })
  }
})

// Получить топ клиентов по посещениям
app.get('/api/top-clients', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const clients = databaseService.getTopClientsByVisits(limit)
    res.json(clients)
  } catch (error) {
    console.error('Error fetching top clients:', error)
    res.status(500).json({ error: 'Failed to fetch top clients' })
  }
})

// Получить участников
app.get('/api/participants', (req, res) => {
  try {
    const participants = databaseService.getParticipants()
    res.json(participants)
  } catch (error) {
    console.error('Error fetching participants:', error)
    res.status(500).json({ error: 'Failed to fetch participants' })
  }
})

// Получить уникальных пользователей
app.get('/api/unique-users', (req, res) => {
  try {
    const users = databaseService.getUniqueUsers()
    res.json(users)
  } catch (error) {
    console.error('Error fetching unique users:', error)
    res.status(500).json({ error: 'Failed to fetch unique users' })
  }
})

// Поиск пользователей
app.get('/api/search-users', (req, res) => {
  try {
    const query = req.query.q as string
    if (!query || query.trim() === '') {
      return res.json([])
    }
    const users = databaseService.searchUsers(query.trim())
    res.json(users)
  } catch (error) {
    console.error('Error searching users:', error)
    res.status(500).json({ error: 'Failed to search users' })
  }
})

// Получить детали конкретного вебинара
app.get('/api/webinars/:id', (req, res) => {
  try {
    const webinarId = parseInt(req.params.id)
    
    if (isNaN(webinarId)) {
      return res.status(400).json({ error: 'Invalid webinar ID' })
    }

    const webinar = databaseService.getWebinarDetail(webinarId)
    
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' })
    }

    res.json(webinar)
  } catch (error) {
    console.error('Error fetching webinar detail:', error)
    res.status(500).json({ error: 'Failed to fetch webinar detail' })
  }
})

// Получить пользователей конкретного вебинара
app.get('/api/webinars/:id/users', (req, res) => {
  try {
    const webinarId = parseInt(req.params.id)
    
    if (isNaN(webinarId)) {
      return res.status(400).json({ error: 'Invalid webinar ID' })
    }

    const users = databaseService.getWebinarUsers(webinarId)
    res.json(users)
  } catch (error) {
    console.error('Error fetching webinar users:', error)
    res.status(500).json({ error: 'Failed to fetch webinar users' })
  }
})

// Получить UTM статистику конкретного вебинара
app.get('/api/webinars/:id/utm-stats', (req, res) => {
  try {
    const webinarId = parseInt(req.params.id)
    
    if (isNaN(webinarId)) {
      return res.status(400).json({ error: 'Invalid webinar ID' })
    }

    const stats = databaseService.getWebinarUtmStats(webinarId)
    res.json(stats)
  } catch (error) {
    console.error('Error fetching UTM stats:', error)
    res.status(500).json({ error: 'Failed to fetch UTM stats' })
  }
})

// Получить детали участника по email
app.get('/api/participants/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const participant = databaseService.getParticipantDetail(email)
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' })
    }
    
    res.json(participant)
  } catch (error) {
    console.error('Error fetching participant detail:', error)
    res.status(500).json({ error: 'Failed to fetch participant detail' })
  }
})

// Получить вебинары участника
app.get('/api/participants/:email/webinars', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const webinars = databaseService.getParticipantWebinars(email)
    res.json(webinars)
  } catch (error) {
    console.error('Error fetching participant webinars:', error)
    res.status(500).json({ error: 'Failed to fetch participant webinars' })
  }
})

// Получить чат участника
app.get('/api/participants/:email/chat', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const chat = databaseService.getParticipantChat(email)
    res.json(chat)
  } catch (error) {
    console.error('Error fetching participant chat:', error)
    res.status(500).json({ error: 'Failed to fetch participant chat' })
  }
})

// Получить вопросы участника
app.get('/api/participants/:email/questions', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const questions = databaseService.getParticipantQuestions(email)
    res.json(questions)
  } catch (error) {
    console.error('Error fetching participant questions:', error)
    res.status(500).json({ error: 'Failed to fetch participant questions' })
  }
})

// Получить ответы на опросы участника
app.get('/api/participants/:email/survey-answers', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const answers = databaseService.getParticipantSurveyAnswers(email)
    res.json(answers)
  } catch (error) {
    console.error('Error fetching participant survey answers:', error)
    res.status(500).json({ error: 'Failed to fetch participant survey answers' })
  }
})

// Получить детали компании по ИНН
app.get('/api/companies/:inn', (req, res) => {
  try {
    const inn = decodeURIComponent(req.params.inn)
    const company = databaseService.getCompanyDetail(inn)
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }
    
    res.json(company)
  } catch (error) {
    console.error('Error fetching company detail:', error)
    res.status(500).json({ error: 'Failed to fetch company detail' })
  }
})

// Получить вебинары компании
app.get('/api/companies/:inn/webinars', (req, res) => {
  try {
    const inn = decodeURIComponent(req.params.inn)
    const webinars = databaseService.getCompanyWebinars(inn)
    res.json(webinars)
  } catch (error) {
    console.error('Error fetching company webinars:', error)
    res.status(500).json({ error: 'Failed to fetch company webinars' })
  }
})

// Получить участников компании
app.get('/api/companies/:inn/participants', (req, res) => {
  try {
    const inn = decodeURIComponent(req.params.inn)
    const participants = databaseService.getCompanyParticipants(inn)
    res.json(participants)
  } catch (error) {
    console.error('Error fetching company participants:', error)
    res.status(500).json({ error: 'Failed to fetch company participants' })
  }
})

// Получить ответы на опросы компании
app.get('/api/companies/:inn/survey-answers', (req, res) => {
  try {
    const inn = decodeURIComponent(req.params.inn)
    const answers = databaseService.getCompanySurveyAnswers(inn)
    res.json(answers)
  } catch (error) {
    console.error('Error fetching company survey answers:', error)
    res.status(500).json({ error: 'Failed to fetch company survey answers' })
  }
})

// Экспорт чатов и вопросов для конкретного вебинара
app.get('/api/export/webinar/:id', async (req, res) => {
  try {
    const webinarId = parseInt(req.params.id)
    
    if (isNaN(webinarId)) {
      return res.status(400).json({ error: 'Invalid webinar ID' })
    }

    const buffer = await exportService.exportWebinarData(webinarId)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=webinar_${webinarId}_export.xlsx`)
    res.send(buffer)
  } catch (error) {
    console.error('Error exporting webinar data:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// Экспорт чатов и вопросов по тегам
app.post('/api/export/tags', async (req, res) => {
  try {
    const { tagIds } = req.body
    
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: 'Tag IDs are required' })
    }

    const buffer = await exportService.exportByTags(tagIds)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=tags_export.xlsx`)
    res.send(buffer)
  } catch (error) {
    console.error('Error exporting by tags:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// Экспорт чатов и вопросов по должностям
app.post('/api/export/positions', async (req, res) => {
  try {
    const { positions } = req.body
    
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({ error: 'Positions are required' })
    }

    const buffer = await exportService.exportByPositions(positions)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=positions_export.xlsx`)
    res.send(buffer)
  } catch (error) {
    console.error('Error exporting by positions:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// Получить список всех должностей
app.get('/api/positions', (req, res) => {
  try {
    const positions = databaseService.getAllPositions()
    res.json(positions)
  } catch (error) {
    console.error('Error fetching positions:', error)
    res.status(500).json({ error: 'Failed to fetch positions' })
  }
})

// Экспорт данных по ИНН
app.post('/api/export/inn', upload.single('file'), async (req, res) => {
  console.log('🔵 Получен запрос на экспорт по ИНН')
  console.log('  req.file:', req.file)
  console.log('  req.body:', req.body)
  
  try {
    if (!req.file) {
      console.log('❌ Файл не найден в запросе')
      return res.status(400).json({ error: 'File is required' })
    }

    const filePath = req.file.path
    const originalName = req.file.originalname
    console.log('  Путь к файлу:', filePath)
    console.log('  Оригинальное имя:', originalName)
    
    // Парсим ИНН из файла
    const innList = await exportService.parseInnFile(filePath, originalName)
    console.log(`  Найдено ИНН: ${innList.length}`)
    
    if (innList.length === 0) {
      console.log('❌ Не найдено валидных ИНН')
      // Удаляем временный файл
      const fs = await import('fs')
      fs.unlinkSync(filePath)
      return res.status(400).json({ error: 'No valid INN found in file' })
    }

    console.log(`✅ Экспорт данных для ${innList.length} ИНН:`, innList.slice(0, 5))
    
    // Экспортируем данные
    const buffer = await exportService.exportByInn(innList)
    
    // Удаляем временный файл
    const fs = await import('fs')
    fs.unlinkSync(filePath)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=inn_export.xlsx`)
    res.send(buffer)
  } catch (error) {
    console.error('❌ Error exporting by INN:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Получить список всех сервисов
app.get('/api/services', async (req, res) => {
  try {
    const services = databaseService.getAllServices()
    res.json(services)
  } catch (error) {
    console.error('Error fetching services:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Экспорт данных по используемым сервисам
app.post('/api/export/services', async (req, res) => {
  console.log('🔵 Получен запрос на экспорт по используемым сервисам')
  
  try {
    const { services } = req.body
    console.log('Выбранные сервисы:', services)
    
    const buffer = await exportService.exportByServices(services)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=services_export_${Date.now()}.xlsx`)
    res.send(buffer)
  } catch (error) {
    console.error('❌ Error exporting by services:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Получить сообщения чата
app.get('/api/messages', (req, res) => {
  try {
    const messages = databaseService.getMessages()
    res.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Получить вопросы
app.get('/api/questions', (req, res) => {
  try {
    const questions = databaseService.getQuestions()
    res.json(questions)
  } catch (error) {
    console.error('Error fetching questions:', error)
    res.status(500).json({ error: 'Failed to fetch questions' })
  }
})

// Получить все вебинары
app.get('/api/webinars', (req, res) => {
  try {
    const webinars = databaseService.getWebinars()
    res.json(webinars)
  } catch (error) {
    console.error('Error fetching webinars:', error)
    res.status(500).json({ error: 'Failed to fetch webinars' })
  }
})

// Получить все теги
app.get('/api/tags', (req, res) => {
  try {
    const tags = databaseService.getAllTags()
    res.json(tags)
  } catch (error) {
    console.error('Error fetching tags:', error)
    res.status(500).json({ error: 'Failed to fetch tags' })
  }
})

// Получить все опросы
app.get('/api/surveys', (req, res) => {
  try {
    const surveys = databaseService.getAllSurveys()
    res.json(surveys)
  } catch (error) {
    console.error('Error fetching surveys:', error)
    res.status(500).json({ error: 'Failed to fetch surveys' })
  }
})

// Удалить опрос
app.delete('/api/surveys/:id', (req, res) => {
  try {
    const surveyId = parseInt(req.params.id)
    
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: 'Invalid survey ID' })
    }

    databaseService.deleteSurvey(surveyId)
    databaseService.saveDatabase()
    
    res.json({ 
      success: true, 
      message: 'Survey deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting survey:', error)
    res.status(500).json({ error: 'Failed to delete survey' })
  }
})

// Получить данные для графика новых клиентов
app.get('/api/new-clients-timeline', (req, res) => {
  try {
    const timeline = databaseService.getNewClientsTimeline()
    res.json(timeline)
  } catch (error) {
    console.error('Error fetching new clients timeline:', error)
    res.status(500).json({ error: 'Failed to fetch new clients timeline' })
  }
})

// Получить данные для общего количества посещений
app.get('/api/total-visitors-timeline', (req, res) => {
  try {
    const timeline = databaseService.getTotalVisitorsTimeline()
    res.json(timeline)
  } catch (error) {
    console.error('Error fetching total visitors timeline:', error)
    res.status(500).json({ error: 'Failed to fetch total visitors timeline' })
  }
})

// Удалить вебинар
app.delete('/api/webinars/:id', (req, res) => {
  try {
    const webinarId = parseInt(req.params.id)
    
    if (isNaN(webinarId)) {
      return res.status(400).json({ error: 'Invalid webinar ID' })
    }

    databaseService.deleteWebinar(webinarId)
    databaseService.saveDatabase()
    
    res.json({ 
      success: true, 
      message: 'Webinar deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting webinar:', error)
    res.status(500).json({ error: 'Failed to delete webinar' })
  }
})

// Загрузить файлы и импортировать данные
app.post('/api/upload', 
  upload.fields([
    { name: 'mainFile', maxCount: 1 },
    { name: 'questionsFile', maxCount: 1 },
    { name: 'chatFile', maxCount: 1 },
    { name: 'surveyFile', maxCount: 1 },
    { name: 'attendanceFile', maxCount: 1 } // Для Proofix
  ]),
  async (req, res) => {
    let webinarId: number | null = null
    
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] }
      const { tags, importPositions, fileFormat, webinarName: userWebinarName, webinarDate: userWebinarDate } = req.body
      const format = fileFormat || 'mts' // По умолчанию МТС-линк

      if (!files.mainFile) {
        return res.status(400).json({ error: 'Main file is required' })
      }

      // Парсить основной файл и получить название вебинара и дату
      const mainFilePath = files.mainFile[0].path
      const { webinarName: parsedWebinarName, webinarDate: parsedWebinarDate } = await parserService.parseMainFile(mainFilePath, null, format)
      
      // Для Proofix используем название и дату из формы, для МТС-линк из файла
      const webinarName = format === 'proofix' ? userWebinarName : (parsedWebinarName || userWebinarName)
      const webinarDate = format === 'proofix' ? userWebinarDate : (parsedWebinarDate || userWebinarDate)
      
      if (!webinarName) {
        return res.status(400).json({ error: 'Webinar name not found in the main file' })
      }

      // Формируем название с датой: "Название_ДД.ММ.ГГГГ"
      let finalWebinarName = webinarName
      if (webinarDate) {
        const date = new Date(webinarDate)
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
        finalWebinarName = `${webinarName}_${formattedDate}`
      }

      // Создать или обновить вебинар с именем из файла и датой
      webinarId = databaseService.createOrUpdateWebinar(finalWebinarName, webinarDate || new Date().toISOString().split('T')[0]) as number

      // Добавить теги
      if (tags) {
        const tagsList = JSON.parse(tags)
        for (const tag of tagsList) {
          const tagId = databaseService.addTag(tag)
          if (tagId) {
            databaseService.linkWebinarTag(webinarId, tagId)
          }
        }
      }

      // Повторно парсить основной файл с ID вебинара
      await parserService.parseMainFile(mainFilePath, webinarId, format)

      // Для Proofix: парсим файл присутствия
      if (format === 'proofix' && files.attendanceFile) {
        const attendanceFilePath = files.attendanceFile[0].path
        await parserService.parseProofixAttendanceFile(attendanceFilePath, webinarId)
      }

      // Для МТС-линк: парсим файл вопросов
      if (format === 'mts' && files.questionsFile) {
        const questionsFilePath = files.questionsFile[0].path
        await parserService.parseQuestionsFile(questionsFilePath, webinarId, format)
      }

      if (files.chatFile) {
        const chatFilePath = files.chatFile[0].path
        await parserService.parseChatFile(chatFilePath, webinarId, format)
      }

      // Парсить файл опросов если загружен
      if (files.surveyFile) {
        const surveyFilePath = files.surveyFile[0].path
        const shouldImportPositions = importPositions === 'true'
        await parserService.parseSurveyFile(surveyFilePath, webinarId, shouldImportPositions, format)
      }

      // Сохраняем БД один раз в конце
      console.log('Сохранение данных в БД...')
      databaseService.saveDatabase()
      console.log('✅ Импорт завершён успешно')

      res.json({ 
        success: true, 
        webinarId,
        webinarName: finalWebinarName,
        webinarDate,
        message: 'Files uploaded and processed successfully' 
      })
    } catch (error) {
      console.error('Error uploading files:', error)
      
      // Откатить изменения - удалить вебинар если он был создан
      if (webinarId) {
        try {
          databaseService.deleteWebinar(webinarId)
        } catch (rollbackError) {
          console.error('Error rolling back:', rollbackError)
        }
      }
      
      res.status(500).json({ 
        error: 'Failed to upload files',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Загрузить файл с опросами
app.post('/api/upload-survey', 
  upload.single('surveyFile'),
  async (req, res) => {
    try {
      const file = req.file
      const { webinarId, importPositions } = req.body

      if (!file) {
        return res.status(400).json({ error: 'Survey file is required' })
      }

      // Парсить файл с опросами
      const surveyFilePath = file.path
      const shouldImportPositions = importPositions === 'true'
      
      // webinarId может быть пустым (опциональная привязка)
      const webinarIdNum = webinarId && webinarId.trim() !== '' ? parseInt(webinarId) : null
      
      await parserService.parseSurveyFile(surveyFilePath, webinarIdNum, shouldImportPositions)

      // Сохраняем БД
      console.log('Сохранение опросов в БД...')
      databaseService.saveDatabase()
      console.log('✅ Импорт опросов завершён успешно')

      res.json({ 
        success: true,
        message: 'Survey file uploaded and processed successfully' 
      })
    } catch (error) {
      console.error('Error uploading survey file:', error)
      
      res.status(500).json({ 
        error: 'Failed to upload survey file',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Получить колонки из Excel файла (для bulk import)
app.post('/api/bulk-import/columns',
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'File is required' })
      }

      const columns = await parserService.readExcelColumns(file.path)
      
      res.json(columns)
    } catch (error) {
      console.error('Error reading columns:', error)
      res.status(500).json({ 
        error: 'Failed to read columns',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Импорт больших файлов с маппингом
app.post('/api/bulk-import',
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file
      const { mappings } = req.body

      if (!file) {
        return res.status(400).json({ error: 'File is required' })
      }

      if (!mappings) {
        return res.status(400).json({ error: 'Column mappings are required' })
      }

      const columnMappings = JSON.parse(mappings)
      
      await parserService.parseBulkFile(file.path, columnMappings)

      // Сохраняем БД
      console.log('Сохранение данных в БД...')
      databaseService.saveDatabase()
      console.log('✅ Bulk импорт завершён успешно')

      res.json({ 
        success: true,
        message: 'Bulk import completed successfully' 
      })
    } catch (error) {
      console.error('Error during bulk import:', error)
      
      res.status(500).json({ 
        error: 'Failed to import file',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
