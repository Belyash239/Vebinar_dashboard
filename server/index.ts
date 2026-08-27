import express from 'express'
import cors from 'cors'
import multer from 'multer'
import * as dotenv from 'dotenv'
import databaseService from './database/database.service.js'
import parserService from './services/parser.service.js'
import exportService from './services/export.service.js'

// Загружаем переменные окружения
dotenv.config()

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

// Получить маппинги полей
app.get('/api/field-mappings', async (req, res) => {
  try {
    const { UNIQUE_FIELDS_POOL } = await import('./services/field-mappings.js')
    res.json({ fields: UNIQUE_FIELDS_POOL })
  } catch (error) {
    console.error('Error loading field mappings:', error)
    res.status(500).json({ error: 'Failed to load field mappings' })
  }
})

// Анализ файла (получение колонок и строк)
app.post('/api/analyze-file',
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'File is required' })
      }

      const result = await parserService.readExcelColumns(file.path)
      
      // Удаляем временный файл
      const fs = await import('fs')
      fs.unlinkSync(file.path)
      
      res.json(result)
    } catch (error) {
      console.error('Error analyzing file:', error)
      res.status(500).json({ 
        error: 'Failed to analyze file',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Извлечение названия и даты вебинара из файла
app.post('/api/extract-webinar-info',
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'File is required' })
      }

      const { webinarName, webinarDate } = await parserService.parseMainFile(file.path, null, 'mts')
      
      // Удаляем временный файл
      const fs = await import('fs')
      fs.unlinkSync(file.path)
      
      res.json({ webinarName, webinarDate })
    } catch (error) {
      console.error('Error extracting webinar info:', error)
      res.status(500).json({ 
        error: 'Failed to extract webinar info',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Загрузка с маппингом
app.post('/api/upload-with-mapping',
  upload.array('files'),
  async (req, res) => {
    let webinarId: number | null = null
    
    try {
      const files = req.files as Express.Multer.File[]
      const { tags, importPositions, webinarName, webinarDate, mappings, formats } = req.body

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'At least one file is required' })
      }

      if (!webinarName || !webinarDate) {
        return res.status(400).json({ error: 'Webinar name and date are required' })
      }

      // Парсим маппинги и форматы
      const mappingsArray = typeof mappings === 'string' ? [mappings] : mappings
      const formatsArray = typeof formats === 'string' ? [formats] : formats
      
      const parsedMappings = mappingsArray.map((m: string) => JSON.parse(m))
      
      // Импортируем функции определения
      const { detectFileType } = await import('./services/field-mappings.js')
      
      // Определяем систему: если есть хотя бы один основной файл МТС-линк, то вся система МТС-линк
      let systemFormat: 'mts' | 'proofix' = formatsArray[0] as 'mts' | 'proofix'
      
      // Проверяем наличие основного файла МТС-линк
      for (let i = 0; i < files.length; i++) {
        const format = formatsArray[i] as 'mts' | 'proofix'
        
        // Определяем тип файла по формату, а не по маппингу
        // Для МТС-линк: ищем основной файл
        if (format === 'mts') {
          // Читаем колонки файла напрямую
          const { columns } = await parserService.readExcelColumns(files[i].path)
          const fileType = detectFileType(columns)
          
          if (fileType === 'main') {
            systemFormat = 'mts'
            console.log('📊 Обнаружен основной файл МТС-линк → система: МТС-линк')
            break
          }
        }
      }
      
      // Если основного МТС-линк нет, определяем по большинству
      if (systemFormat !== 'mts') {
        const formatCounts: Record<string, number> = {}
        for (const f of formatsArray) {
          formatCounts[f] = (formatCounts[f] || 0) + 1
        }
        
        let maxCount = 0
        let dominantFormat = formatsArray[0] as 'mts' | 'proofix'
        
        for (const [format, count] of Object.entries(formatCounts)) {
          if (count > maxCount) {
            maxCount = count
            dominantFormat = format as 'mts' | 'proofix'
          }
        }
        
        systemFormat = dominantFormat
        console.log('📊 Определена система по большинству:', systemFormat, formatCounts)
      }
      
      console.log(`📊 Итоговая система: ${systemFormat}`)
      
      // Формируем название с датой
      const date = new Date(webinarDate)
      const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
      const formattedWebinarName = `${webinarName}_${formattedDate}`

      // Создать вебинар
      webinarId = databaseService.createOrUpdateWebinar(formattedWebinarName, webinarDate) as number

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

      // Группируем файлы по типу
      const filesByType: Record<string, { file: Express.Multer.File, mapping: Record<string, string> }[]> = {
        main: [],
        questions: [],
        chat: [],
        survey: [],
        attendance: []
      }
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Сначала определяем тип файла по названиям листов (быстро)
        let fileType = await parserService.detectFileTypeBySheets(file.path)
        
        // Если тип unknown, читаем колонки и определяем по старому методу
        if (fileType === 'unknown') {
          const { columns } = await parserService.readExcelColumns(file.path, 'main')
          fileType = detectFileType(columns)
        } else {
          // Читаем колонки с правильным типом
          await parserService.readExcelColumns(file.path, fileType)
        }
        
        console.log(`📄 Файл ${file.originalname}: тип = ${fileType}`)
        
        if (fileType !== 'unknown') {
          const mapping = parsedMappings[i]
          filesByType[fileType].push({ file, mapping })
          console.log(`  ✓ Добавлен в filesByType.${fileType}`)
        } else {
          console.log(`  ✗ Тип unknown, файл пропущен`)
        }
      }

      console.log(`\n📊 Итоговое распределение файлов по типам:`)
      console.log(`  - main: ${filesByType.main.length}`)
      console.log(`  - questions: ${filesByType.questions.length}`)
      console.log(`  - chat: ${filesByType.chat.length}`)
      console.log(`  - survey: ${filesByType.survey.length}`)
      console.log(`  - attendance: ${filesByType.attendance.length}`)

      // Обрабатываем файлы существующими парсерами с ЕДИНОЙ системой
      
      // 1. Основной файл
      if (filesByType.main.length > 0) {
        const { file } = filesByType.main[0]
        console.log(`🔧 Парсинг основного файла с форматом: ${systemFormat}`)
        await parserService.parseMainFile(file.path, webinarId, systemFormat)
      }
      
      // 2. Вопросы (только МТС-линк)
      if (systemFormat === 'mts' && filesByType.questions.length > 0) {
        const { file } = filesByType.questions[0]
        console.log(`🔧 Парсинг вопросов с форматом: ${systemFormat}`)
        await parserService.parseQuestionsFile(file.path, webinarId, systemFormat)
      }
      
      // 3. Чат
      if (filesByType.chat.length > 0) {
        const { file } = filesByType.chat[0]
        console.log(`🔧 Парсинг чата с форматом: ${systemFormat}`)
        await parserService.parseChatFile(file.path, webinarId, systemFormat)
      }
      
      // 4. Опросы (может быть несколько файлов)
      if (filesByType.survey.length > 0) {
        const shouldImportPositions = importPositions === 'true'
        console.log(`🔧 Парсинг опросов: ${filesByType.survey.length} файл(ов) с форматом: ${systemFormat}`)
        
        for (let i = 0; i < filesByType.survey.length; i++) {
          const { file } = filesByType.survey[i]
          console.log(`  📊 Опрос ${i + 1}/${filesByType.survey.length}: ${file.originalname}`)
          await parserService.parseSurveyFile(file.path, webinarId, shouldImportPositions, systemFormat)
        }
      }
      
      // 5. Присутствие (только Proofix)
      if (systemFormat === 'proofix' && filesByType.attendance.length > 0) {
        const { file } = filesByType.attendance[0]
        console.log(`🔧 Парсинг присутствия Proofix`)
        await parserService.parseProofixAttendanceFile(file.path, webinarId)
      }

      // Сохраняем БД
      console.log('Сохранение данных в БД...')
      databaseService.saveDatabase()
      console.log('✅ Импорт завершён успешно')

      res.json({ 
        success: true, 
        webinarId,
        webinarName: formattedWebinarName,
        webinarDate,
        message: 'Files uploaded and processed successfully' 
      })
    } catch (error) {
      console.error('Error uploading files:', error)
      
      // Откатить изменения
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

// Унифицированная загрузка файлов с автоматическим определением формата
app.post('/api/upload-unified', 
  upload.fields([
    { name: 'mainFile', maxCount: 1 },
    { name: 'chatFile', maxCount: 1 },
    { name: 'surveyFile', maxCount: 1 },
    { name: 'attendanceFile', maxCount: 1 }
  ]),
  async (req, res) => {
    let webinarId: number | null = null
    
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] }
      const { tags, importPositions, webinarName, webinarDate } = req.body

      if (!files.mainFile) {
        return res.status(400).json({ error: 'Main file is required' })
      }

      // Определяем формат по количеству колонок в основном файле
      const mainFilePath = files.mainFile[0].path
      const { columns } = await parserService.readExcelColumns(mainFilePath)
      
      console.log(`📊 Колонок в основном файле: ${columns.length}`)
      
      // Эвристика: МТС-линк имеет >20 колонок, Proofix имеет ~8 колонок
      const format: 'mts' | 'proofix' = columns.length > 15 ? 'mts' : 'proofix'
      
      console.log(`🔍 Автоматически определён формат: ${format}`)

      // Парсить основной файл и получить название вебинара и дату
      const { webinarName: parsedWebinarName, webinarDate: parsedWebinarDate } = await parserService.parseMainFile(mainFilePath, null, format)
      
      // Для Proofix используем название и дату из формы, для МТС-линк из файла
      const finalWebinarName = format === 'proofix' ? webinarName : (parsedWebinarName || webinarName)
      const finalWebinarDate = format === 'proofix' ? webinarDate : (parsedWebinarDate || webinarDate)
      
      if (!finalWebinarName) {
        return res.status(400).json({ error: 'Webinar name not found' })
      }

      // Формируем название с датой
      let formattedWebinarName = finalWebinarName
      if (finalWebinarDate) {
        const date = new Date(finalWebinarDate)
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
        formattedWebinarName = `${finalWebinarName}_${formattedDate}`
      }

      // Создать или обновить вебинар
      webinarId = databaseService.createOrUpdateWebinar(formattedWebinarName, finalWebinarDate || new Date().toISOString().split('T')[0]) as number

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

      // Парсим чат
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

      // Сохраняем БД
      console.log('Сохранение данных в БД...')
      databaseService.saveDatabase()
      console.log('✅ Импорт завершён успешно')

      res.json({ 
        success: true, 
        webinarId,
        webinarName: formattedWebinarName,
        webinarDate: finalWebinarDate,
        detectedFormat: format,
        message: 'Files uploaded and processed successfully' 
      })
    } catch (error) {
      console.error('Error uploading files:', error)
      
      // Откатить изменения
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
    console.log('\n📋 ЗАПРОС НА ЧТЕНИЕ КОЛОНОК ФАЙЛА')
    
    try {
      const file = req.file

      if (!file) {
        console.log('❌ Файл не предоставлен')
        return res.status(400).json({ error: 'File is required' })
      }

      console.log(`📂 Файл: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      console.log('🔍 Читаю колонки...')
      
      const columns = await parserService.readExcelColumns(file.path)
      
      console.log(`✅ Прочитано ${columns.columns.length} колонок, ${columns.rowCount} строк данных\n`)
      
      res.json(columns)
    } catch (error) {
      console.error('❌ Ошибка чтения колонок:', error)
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
    console.log('\n' + '='.repeat(70))
    console.log('📥 ПОЛУЧЕН ЗАПРОС НА ИМПОРТ БОЛЬШИХ ДАННЫХ')
    console.log('='.repeat(70))
    
    try {
      const file = req.file
      const { mappings } = req.body

      if (!file) {
        console.log('❌ Ошибка: файл не предоставлен')
        return res.status(400).json({ error: 'File is required' })
      }

      console.log(`📂 Файл получен: ${file.originalname}`)
      console.log(`📏 Размер: ${(file.size / 1024 / 1024).toFixed(2)} MB`)

      if (!mappings) {
        console.log('❌ Ошибка: маппинг колонок не предоставлен')
        return res.status(400).json({ error: 'Column mappings are required' })
      }

      const columnMappings = JSON.parse(mappings)
      console.log(`🔗 Получено маппингов: ${columnMappings.length}`)
      
      // Используем потоковую версию для больших файлов
      await parserService.parseBulkFileStreaming(file.path, columnMappings)

      // Сохраняем БД с обработкой ошибок
      console.log('💾 Финальное сохранение данных в БД...')
      try {
        databaseService.saveDatabase()
        console.log('✅ БД сохранена успешно')
      } catch (saveError) {
        console.error('⚠️ Ошибка при финальном сохранении БД:', saveError)
        console.log('⚠️ Данные остались в памяти, попробуйте перезапустить сервер для сохранения')
      }
      
      console.log('✅ Bulk импорт завершён успешно\n')

      res.json({ 
        success: true,
        message: 'Bulk import completed successfully' 
      })
    } catch (error) {
      console.error('❌ Ошибка во время bulk импорта:', error)
      
      res.status(500).json({ 
        error: 'Failed to import file',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Endpoint для обогащения данных компании из DaData по ИНН
app.post('/api/enrich-company/:inn', async (req, res) => {
  try {
    const { inn } = req.params
    
    if (!inn) {
      return res.status(400).json({ error: 'ИНН не указан' })
    }

    console.log(`🔍 Запрос обогащения данных для ИНН: ${inn}`)

    const { dadataService } = await import('./services/dadata.service')
    const companyData = await dadataService.getCompanyByInn(inn)

    if (!companyData) {
      return res.status(404).json({ error: 'Компания не найдена в DaData' })
    }

    // Обновляем данные в БД
    databaseService.updateCompanyFromDaData(inn, {
      name: companyData.name,
      kpp: companyData.kpp,
      ogrn: companyData.ogrn,
      mainOkved: companyData.mainOkved,
      additionalOkveds: companyData.additionalOkveds,
      branchType: companyData.branchType,
      organizationType: companyData.organizationType,
      opf: companyData.opf,
      taxSystem: companyData.taxSystem,
      status: companyData.status,
      income: companyData.income,
      expense: companyData.expense
    })

    databaseService.saveDatabase()

    console.log(`✅ Данные компании ${inn} обновлены`)

    res.json({ 
      success: true, 
      data: companyData 
    })
  } catch (error) {
    console.error('❌ Ошибка при обогащении данных компании:', error)
    res.status(500).json({ 
      error: 'Ошибка при обогащении данных',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Endpoint для пакетного обогащения компаний
app.post('/api/enrich-companies-batch', async (req, res) => {
  try {
    const { limit = 100 } = req.body

    console.log(`📦 Запуск пакетного обогащения компаний (лимит: ${limit})`)

    // Получаем список компаний, которым нужно обновление
    const innsToUpdate = databaseService.getCompaniesNeedingDaDataUpdate(limit)

    if (innsToUpdate.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Все компании уже обновлены',
        updated: 0,
        total: 0
      })
    }

    console.log(`🔄 Найдено компаний для обновления: ${innsToUpdate.length}`)

    const { dadataService } = await import('./services/dadata.service')
    let updatedCount = 0

    for (const inn of innsToUpdate) {
      const companyData = await dadataService.getCompanyByInn(inn)
      
      if (companyData) {
        databaseService.updateCompanyFromDaData(inn, {
          name: companyData.name,
          kpp: companyData.kpp,
          ogrn: companyData.ogrn,
          mainOkved: companyData.mainOkved,
          additionalOkveds: companyData.additionalOkveds,
          branchType: companyData.branchType,
          organizationType: companyData.organizationType,
          opf: companyData.opf,
          taxSystem: companyData.taxSystem,
          status: companyData.status,
          income: companyData.income,
          expense: companyData.expense
        })
        updatedCount++
      }

      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 60))
    }

    databaseService.saveDatabase()

    console.log(`✅ Обновлено компаний: ${updatedCount} из ${innsToUpdate.length}`)

    res.json({ 
      success: true, 
      message: `Обновлено ${updatedCount} компаний`,
      updated: updatedCount,
      total: innsToUpdate.length
    })
  } catch (error) {
    console.error('❌ Ошибка при пакетном обогащении:', error)
    res.status(500).json({ 
      error: 'Ошибка при пакетном обогащении',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Endpoint для получения статистики по обогащению компаний
app.get('/api/companies-enrichment-stats', (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Дата_обновления_DaData IS NOT NULL THEN 1 ELSE 0 END) as enriched,
        SUM(CASE WHEN Дата_обновления_DaData IS NULL THEN 1 ELSE 0 END) as notEnriched,
        SUM(CASE 
          WHEN Дата_обновления_DaData IS NOT NULL 
            AND datetime(Дата_обновления_DaData) < datetime('now', '-30 days') 
          THEN 1 
          ELSE 0 
        END) as outdated
      FROM Компания
    `
    
    const stats = databaseService.execQueryForExport(query)[0]
    
    res.json({
      total: stats.total,
      enriched: stats.enriched,
      notEnriched: stats.notEnriched,
      outdated: stats.outdated,
      needsUpdate: stats.notEnriched + stats.outdated
    })
  } catch (error) {
    console.error('❌ Ошибка при получении статистики:', error)
    res.status(500).json({ 
      error: 'Ошибка при получении статистики',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
