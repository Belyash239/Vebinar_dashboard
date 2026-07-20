import express from 'express'
import cors from 'cors'
import multer from 'multer'
import databaseService from './database/database.service.js'
import parserService from './services/parser.service.js'

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
    { name: 'chatFile', maxCount: 1 }
  ]),
  async (req, res) => {
    let webinarId: number | null = null
    
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] }
      const { webinarName, tags } = req.body

      if (!webinarName || !files.mainFile) {
        return res.status(400).json({ error: 'Webinar name and main file are required' })
      }

      // Создать вебинар с временной датой
      const tempDate = new Date().toISOString().split('T')[0]
      webinarId = databaseService.createWebinar(webinarName, tempDate) as number

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

      // Парсить основной файл и получить дату проведения
      const mainFilePath = files.mainFile[0].path
      const webinarDate = await parserService.parseMainFile(mainFilePath, webinarId)
      
      // Обновить дату вебинара, если она была найдена в файле
      if (webinarDate) {
        databaseService.updateWebinarDate(webinarId, webinarDate)
      }

      if (files.questionsFile) {
        const questionsFilePath = files.questionsFile[0].path
        await parserService.parseQuestionsFile(questionsFilePath, webinarId)
      }

      if (files.chatFile) {
        const chatFilePath = files.chatFile[0].path
        await parserService.parseChatFile(chatFilePath, webinarId)
      }

      // Сохраняем БД один раз в конце
      console.log('Сохранение данных в БД...')
      databaseService.saveDatabase()
      console.log('✅ Импорт завершён успешно')

      res.json({ 
        success: true, 
        webinarId,
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
