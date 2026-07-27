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
    { name: 'chatFile', maxCount: 1 }
  ]),
  async (req, res) => {
    let webinarId: number | null = null
    
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] }
      const { tags } = req.body

      if (!files.mainFile) {
        return res.status(400).json({ error: 'Main file is required' })
      }

      // Парсить основной файл и получить название вебинара и дату
      const mainFilePath = files.mainFile[0].path
      const { webinarName, webinarDate } = await parserService.parseMainFile(mainFilePath, null)
      
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

      // Создать вебинар с именем из файла и датой
      webinarId = databaseService.createWebinar(finalWebinarName, webinarDate || new Date().toISOString().split('T')[0]) as number

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
      await parserService.parseMainFile(mainFilePath, webinarId)

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
