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

  // Экспорт чатов и вопросов по должностям (полная информация как по ИНН)
  async exportByPositions(positions: string[]): Promise<Buffer> {
    if (positions.length === 0) {
      throw new Error('Список должностей пуст')
    }

    // Маппинг должностей для поиска вариаций
    const positionMapping: { [key: string]: string[] } = {
      // Бухгалтеры
      'Главный бухгалтер': ['главный бухгалтер', 'главбух'],
      'Штатный бухгалтер': ['штатный бухгалтер'],
      'Бухгалтер на аутсорсе (частная практика)': ['бухгалтер на аутсорсе', 'частная практика', 'аутсорс бухгалтер'],
      'Заместитель главного бухгалтера': ['заместитель главного бухгалтера', 'зам главного бухгалтера', 'заместитель главбуха'],
      'Ведущий бухгалтер': ['ведущий бухгалтер'],
      'Старший бухгалтер': ['старший бухгалтер'],
      'Бухгалтер-материалист': ['бухгалтер-материалист', 'бухгалтер материалист'],
      'Руководитель / владелец бухгалтерской фирмы': ['руководитель бухгалтерской фирмы', 'владелец бухгалтерской фирмы'],
      
      // Директора и руководители высшего звена
      'Генеральный директор/ Директор': ['генеральный директор', 'ген. директор', 'ген.директор', 'гендиректор', 'директор', 'Ген директор'],
      'Исполнительный директор': ['исполнительный директор', 'исп. директор'],
      'Коммерческий директор': ['коммерческий директор', 'ком. директор'],
      'Финансовый директор': ['финансовый директор', 'фин. директор'],
      'Директор по логистике': ['директор по логистике'],
      'ИТ-директор': ['ит-директор', 'it-директор', 'директор по it', 'директор по ит'],
      'Директор по развитию': ['директор по развитию'],
      'Директор по снабжению': ['директор по снабжению'],
      'Директор по закупкам': ['директор по закупкам'],
      'Директор по транспорту': ['директор по транспорту'],
      'Операционный директор': ['операционный директор'],
      'Заместитель генерального директора/директора': ['заместитель генерального директора', 'зам генерального директора', 'заместитель директора', 'зам директора', 'зам. директора'],
      
      // Руководители отделов и департаментов
      'Руководитель отдела / Начальник отдела': ['руководитель отдела', 'начальник отдела', 'руководитель отд', 'начальник отд'],
      'Руководитель департамента': ['руководитель департамента'],
      'Руководитель группы': ['руководитель группы'],
      'Руководитель ИТ / Начальник отдела ИТ / Начальник департамента ИТ и связи': ['руководитель ит', 'начальник отдела ит', 'начальник департамента ит', 'руководитель it', 'начальник отдела it'],
      'Руководитель отдела логистики / Начальник отдела логистики': ['руководитель отдела логистики', 'начальник отдела логистики'],
      'Руководитель отдела транспортной логистики': ['руководитель отдела транспортной логистики', 'начальник отдела транспортной логистики'],
      'Руководитель отдела продаж': ['руководитель отдела продаж', 'начальник отдела продаж', 'рук. отдела продаж'],
      'Руководитель отдела закупок': ['руководитель отдела закупок', 'начальник отдела закупок'],
      'Руководитель отдела снабжения': ['руководитель отдела снабжения', 'начальник отдела снабжения'],
      'Руководитель отдела сопровождения': ['руководитель отдела сопровождения', 'начальник отдела сопровождения'],
      'Руководитель юридического отдела': ['руководитель юридического отдела', 'начальник юридического отдела'],
      
      // ИТ-специалисты
      'Инженер-программист': ['инженер-программист', 'инженер программист'],
      'Программист 1С': ['программист 1с', 'программист 1c'],
      'Системный администратор': ['системный администратор', 'сисадмин', 'системный админ'],
      'Системный аналитик': ['системный аналитик'],
      'Бизнес-аналитик': ['бизнес-аналитик', 'бизнес аналитик'],
      'Аналитик 1С': ['аналитик 1с', 'аналитик 1c'],
      'Инженер по сопровождению ПП 1С': ['инженер по сопровождению пп 1с', 'инженер по сопровождению 1с'],
      'Сервис-инженер / Старший сервис-инженер / Ведущий сервис-инженер': ['сервис-инженер', 'старший сервис-инженер', 'ведущий сервис-инженер', 'сервис инженер'],
      'Технический специалист': ['технический специалист', 'тех. специалист'],
      'Специалист по внедрению ПО / Специалист по внедрению ИС': ['специалист по внедрению по', 'специалист по внедрению ис', 'специалист по внедрению'],
      'Специалист по информационным системам': ['специалист по информационным системам', 'специалист по ис'],
      'Функциональный архитектор / Функциональный архитектор 1С': ['функциональный архитектор', 'функциональный архитектор 1с'],
      
      // Консультанты
      'Консультант / Специалист-консультант': ['консультант', 'специалист-консультант', 'специалист консультант'],
      'Консультант 1С': ['консультант 1с', 'консультант 1c'],
      'Ведущий консультант / Ведущий консультант 1С': ['ведущий консультант', 'ведущий консультант 1с'],
      'Старший консультант / Старший консультант 1С': ['старший консультант', 'старший консультант 1с'],
      'Консультант-аналитик': ['консультант-аналитик', 'консультант аналитик'],
      'Консультант по внедрению и поддержке': ['консультант по внедрению и поддержке', 'консультант по внедрению'],
      
      // Логисты
      'Логист / Ведущий логист': ['логист', 'ведущий логист'],
      'Менеджер по логистике': ['менеджер по логистике'],
      'Специалист по логистике / Старший специалист по логистике': ['специалист по логистике', 'старший специалист по логистике'],
      'Аналитик транспортной логистики': ['аналитик транспортной логистики'],
      'Специалист по транспортной логистике': ['специалист по транспортной логистике'],
      'Диспетчер': ['диспетчер'],
      'Экспедитор': ['экспедитор'],
      
      // Менеджеры
      'Менеджер по работе с клиентами / Клиент-менеджер': ['менеджер по работе с клиентами', 'клиент-менеджер', 'клиент менеджер'],
      'Менеджер по сопровождению': ['менеджер по сопровождению'],
      'Менеджер по продажам': ['менеджер по продажам'],
      'Менеджер по развитию': ['менеджер по развитию'],
      'Менеджер проектов / Проектный менеджер / Руководитель проектов': ['менеджер проектов', 'проектный менеджер', 'руководитель проектов'],
      'Менеджер по закупкам': ['менеджер по закупкам'],
      'Менеджер по транспорту': ['менеджер по транспорту'],
      'Старший менеджер': ['старший менеджер'],
      'Ведущий менеджер': ['ведущий менеджер'],
      
      // Юристы
      'Юрист': ['юрист'],
      'Юрисконсульт': ['юрисконсульт'],
      'Главный юрисконсульт': ['главный юрисконсульт'],
      'Ведущий юрисконсульт': ['ведущий юрисконсульт'],
      'Старший юрист': ['старший юрист'],
      'Налоговый юрист': ['налоговый юрист'],
      'Юрист по IT': ['юрист по it', 'юрист по ит', 'it юрист'],
      'Руководитель юридического департамента': ['руководитель юридического департамента'],
      
      // Специалисты
      'Специалист / Ведущий специалист / Главный специалист / Старший специалист': ['специалист', 'ведущий специалист', 'главный специалист', 'старший специалист'],
      'Специалист 1С / 1С специалист': ['специалист 1с', '1с специалист', 'специалист 1c'],
      'Специалист по сопровождению / Специалист по сопровождению сервисов': ['специалист по сопровождению', 'специалист по сопровождению сервисов'],
      'Специалист технической поддержки': ['специалист технической поддержки', 'специалист тех. поддержки'],
      'Специалист отдела логистики': ['специалист отдела логистики'],
      'Специалист ВЭД': ['специалист вэд', 'специалист внешнеэкономической деятельности'],
      
      // Предприниматели и владельцы
      'Индивидуальный предприниматель / ИП': ['индивидуальный предприниматель', 'ип', 'и.п.', 'и. п.'],
      'Руководитель / собственник бизнеса': ['руководитель бизнеса', 'собственник бизнеса'],
      'Собственник/владелец бизнеса': ['собственник бизнеса', 'владелец бизнеса', 'владелец'],
      'Предприниматель': ['предприниматель'],
      'Учредитель': ['учредитель'],
      
      // Прочие должности
      'Методист': ['методист'],
      'Экономист': ['экономист'],
      'Аудитор': ['аудитор'],
      'Офис-менеджер': ['офис-менеджер', 'офис менеджер', 'офисный менеджер'],
      'Помощник директора': ['помощник директора', 'помощник руководителя'],
      'Кладовщик': ['кладовщик'],
      'Водитель': ['водитель'],
      'Мастер производства': ['мастер производства'],
      'Механик': ['механик'],
      'Инженер': ['инженер'],
      'Товаровед': ['товаровед'],
      'Администратор': ['администратор'],
      'Делопроизводитель': ['делопроизводитель'],
      'Копирайтер': ['копирайтер'],
      'Маркетолог': ['маркетолог'],
      'Оператор': ['оператор'],
      'Самозанятый': ['самозанятый', 'самозанятая']
    }

    const workbook = XLSX.utils.book_new()

    // Лист 1: Участники с выбранными должностями
    const participantsData: any[] = []
    
    // Лист 2: Вебинары участников с этими должностями
    const webinarsData: any[] = []
    
    // Лист 3: Чаты участников
    const chatsData: any[] = []
    
    // Лист 4: Вопросы участников
    const questionsData: any[] = []
    
    // Лист 5: Ответы на опросы участников
    const surveyAnswersData: any[] = []

    console.log(`Экспорт данных для должностей: ${positions.join(', ')}`)

    // Обрабатываем каждую должность отдельно чтобы избежать проблем с SQL
    for (const position of positions) {
      console.log(`Обработка должности: ${position}`)
      
      // Получаем паттерны для поиска
      const searchPatterns = positionMapping[position] || [position]
      console.log(`Паттерны поиска: ${searchPatterns.join(', ')}`)
      
      // Для отладки: показываем все существующие должности в БД (только для первой итерации)
      if (position === positions[0]) {
        const allPositions = databaseService.execQueryForExport(`
          SELECT DISTINCT TRIM(Должность) as position, COUNT(*) as count
          FROM Участники 
          WHERE Должность IS NOT NULL AND TRIM(Должность) != ''
          GROUP BY TRIM(Должность)
          ORDER BY count DESC
          LIMIT 20
        `)
        console.log(`Должности в БД (топ-20):`)
        allPositions.forEach((p: any) => {
          console.log(`  "${p.position}" (${p.count} участников)`)
        })
      }
      
      // Получаем участников для всех паттернов этой должности
      const allParticipantsForPosition: any[] = []
      
      for (const pattern of searchPatterns) {
        console.log(`  Поиск по паттерну: "${pattern}"`)
        
        // Получаем ВСЕ записи с должностями и фильтруем на стороне JS
        const allWithPositions = databaseService.execQueryForExport(`
          SELECT 
            u.ID_участника as participantId,
            (SELECT e.Email FROM Email e WHERE e.ID_участника = u.ID_участника LIMIT 1) as email,
            u.Имя as firstName,
            u.Фамилия as lastName,
            u.Должность as position,
            u.Номер_телефона as phone,
            c.ИНН_компании as inn,
            c.Название as companyName
          FROM Участники u
          LEFT JOIN Компания c ON u.ID_компании = c.ID_компании
          WHERE u.Должность IS NOT NULL
            AND TRIM(u.Должность) != ''
          ORDER BY u.ID_участника
        `)
        
        // Фильтруем на стороне JS с правильной обработкой кириллицы
        const patternLower = pattern.toLowerCase().trim()
        const participants = allWithPositions.filter((p: any) => {
          if (!p.position) return false
          const positionLower = p.position.toLowerCase().trim()
          
          // Для "ип" требуем точное совпадение или наличие слова целиком
          if (patternLower === 'ип') {
            if (positionLower === 'ип') return true
            const words = positionLower.split(/[\s,\.\-\/]+/)
            return words.includes('ип')
          }
          
          // Для "директор" - только точное совпадение
          if (patternLower === 'директор') {
            return positionLower === 'директор'
          }
          
          // Для паттернов с "ген" и "гендиректор" - исключаем замов
          if (patternLower.includes('ген') || patternLower.includes('гендиректор')) {
            // Проверяем, что должность содержит паттерн
            if (!positionLower.includes(patternLower)) return false
            // Исключаем замов
            if (positionLower.includes('зам') || positionLower.includes('заместитель')) return false
            return true
          }
          
          // Для остальных - содержит подстроку
          return positionLower.includes(patternLower)
        })
        
        console.log(`    Всего записей с должностями: ${allWithPositions.length}`)
        console.log(`    Отфильтровано для паттерна "${pattern}": ${participants.length}`)
        
        // Показываем первые 5 найденных должностей для проверки
        if (participants.length > 0) {
          console.log(`    Первые должности из результата:`)
          participants.slice(0, 5).forEach((p: any, idx: number) => {
            console.log(`      ${idx + 1}. "${p.position}" (Email: ${p.email || 'нет'})`)
          })
        }
        
        // Добавляем участников в общий список (избегаем дублей по email)
        participants.forEach((p: any) => {
          const alreadyAdded = allParticipantsForPosition.some(ap => ap.email === p.email)
          if (!alreadyAdded) {
            allParticipantsForPosition.push(p)
          }
        })
      }

      console.log(`Найдено участников для "${position}": ${allParticipantsForPosition.length}`)

      // 1. Участники
      allParticipantsForPosition.forEach((p: any) => {
        // Проверяем, не добавлен ли уже этот участник (чтобы избежать дублей)
        const alreadyAdded = participantsData.some(pd => pd.Email === p.email)
        if (!alreadyAdded) {
          participantsData.push({
            'Должность': p.position || '-',
            'Email': p.email || '-',
            'Имя': p.firstName || '-',
            'Фамилия': p.lastName || '-',
            'Телефон': p.phone || '-',
            'ИНН компании': p.inn || '-',
            'Название компании': p.companyName || '-'
          })
        }
      })

      // 2. Для каждого участника получаем вебинары с полной информацией
      for (const participant of allParticipantsForPosition) {
        const participantId = participant.participantId

        const webinarsWithDetails = databaseService.execQueryForExport(`
          SELECT 
            w.ID_вебинара as webinarId,
            w.Название as webinarName,
            w.Дата as webinarDate,
            (SELECT GROUP_CONCAT(t2.Название_тега, ', ')
             FROM "Вебинары-Теги" wt2
             INNER JOIN Тег t2 ON wt2.ID_тега = t2.ID_тега
             WHERE wt2.ID_мероприятия = w.ID_вебинара) as tags,
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
          INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
          WHERE uw.ID_участника = ?
          ORDER BY w.Дата DESC
        `, [participantId])
        
        webinarsWithDetails.forEach((wd: any) => {
          webinarsData.push({
            'Должность': participant.position || '-',
            'Email участника': participant.email,
            'Имя': participant.firstName || '-',
            'Фамилия': participant.lastName || '-',
            'Телефон': participant.phone || '-',
            'ИНН компании': participant.inn || '-',
            'Название компании': participant.companyName || '-',
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

        // 3. Чаты
        const chats = databaseService.getParticipantChat(participant.email)
        chats.forEach((c: any) => {
          chatsData.push({
            'Должность': participant.position || '-',
            'ИНН компании': participant.inn || '-',
            'Название компании': participant.companyName || '-',
            'Email участника': participant.email,
            'Вебинар': c.webinarName || '-',
            'Дата вебинара': c.webinarDate || '-',
            'Время': c.time || '-',
            'Сообщение': c.message || '-'
          })
        })
        
        // 4. Вопросы
        const questions = databaseService.getParticipantQuestions(participant.email)
        questions.forEach((q: any) => {
          questionsData.push({
            'Должность': participant.position || '-',
            'ИНН компании': participant.inn || '-',
            'Название компании': participant.companyName || '-',
            'Email участника': participant.email,
            'Вебинар': q.webinarName || '-',
            'Дата вебинара': q.webinarDate || '-',
            'Вопрос': q.question || '-',
            'Статус': q.status || '-',
            'Отвечающий': q.responder || '-',
            'Ответ': q.answer || '-'
          })
        })
        
        // 5. Ответы на опросы
        const surveyAnswers = databaseService.getParticipantSurveyAnswers(participant.email)
        surveyAnswers.forEach((sa: any) => {
          surveyAnswersData.push({
            'Должность': participant.position || '-',
            'ИНН компании': participant.inn || '-',
            'Название компании': participant.companyName || '-',
            'Email участника': participant.email,
            'Вебинар': sa.webinarName || '-',
            'Дата вебинара': sa.webinarDate || '-',
            'Вопрос опроса': sa.question || '-',
            'Ответ': sa.answer || '-'
          })
        })
      }
    }

    // Создаём листы Excel
    
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

    console.log(`Экспорт по должностям завершён:
  - Участников: ${participantsData.length}
  - Вебинаров: ${webinarsData.length}
  - Чатов: ${chatsData.length}
  - Вопросов: ${questionsData.length}
  - Ответов на опросы: ${surveyAnswersData.length}`)

    // Конвертируем в Buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return buffer
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

  // Экспорт данных по используемым сервисам
  async exportByServices(selectedServices?: string[]): Promise<Buffer> {
    console.log('Начинаем экспорт по используемым сервисам')
    if (selectedServices && selectedServices.length > 0) {
      console.log(`Выбрано сервисов: ${selectedServices.length}`)
    } else {
      console.log('Экспорт всех сервисов')
    }

    const workbook = XLSX.utils.book_new()

    // Получаем данные о сервисах из опросов
    let serviceData = databaseService.getServiceUsageData()

    // Фильтруем по выбранным сервисам если указаны
    if (selectedServices && selectedServices.length > 0) {
      serviceData = serviceData.filter((row: any) => 
        selectedServices.includes(row.service.trim())
      )
    }

    console.log(`Получено записей: ${serviceData.length}`)

    // Лист 1: Участники
    const participantsData: any[] = []
    const processedParticipants = new Set<string>()

    serviceData.forEach((row: any) => {
      if (!processedParticipants.has(row.email)) {
        processedParticipants.add(row.email)
        
        participantsData.push({
          'Используемые сервисы': row.service || '-',
          'Email': row.email || '-',
          'Имя': row.firstName || '-',
          'Фамилия': row.lastName || '-',
          'Должность': row.position || '-',
          'Телефон': row.phone || '-',
          'ИНН компании': row.inn || '-',
          'Название компании': row.companyName || '-'
        })
      }
    })

    const participantsSheet = XLSX.utils.json_to_sheet(participantsData.length > 0 ? participantsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, participantsSheet, 'Участники')

    // Лист 2: Вебинары участников с этими сервисами
    const webinarsData: any[] = []
    
    for (const row of serviceData) {
      const participantId = row.participantId

      const webinarsWithDetails = databaseService.execQueryForExport(`
        SELECT 
          w.ID_вебинара as webinarId,
          w.Название as webinarName,
          w.Дата as webinarDate,
          (SELECT GROUP_CONCAT(t2.Название_тега, ', ')
           FROM "Вебинары-Теги" wt2
           INNER JOIN Тег t2 ON wt2.ID_тега = t2.ID_тега
           WHERE wt2.ID_мероприятия = w.ID_вебинара) as tags,
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
        INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
        WHERE uw.ID_участника = ?
        ORDER BY w.Дата DESC
      `, [participantId])
      
      webinarsWithDetails.forEach((wd: any) => {
        webinarsData.push({
          'Используемые сервисы': row.service || '-',
          'Email участника': row.email,
          'Имя': row.firstName || '-',
          'Фамилия': row.lastName || '-',
          'Должность': row.position || '-',
          'Телефон': row.phone || '-',
          'ИНН компании': row.inn || '-',
          'Название компании': row.companyName || '-',
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
    }

    const webinarsSheet = XLSX.utils.json_to_sheet(webinarsData.length > 0 ? webinarsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, webinarsSheet, 'Вебинары')

    // Лист 3: Чаты
    const chatsData: any[] = []
    const processedForChats = new Set<string>()
    
    for (const row of serviceData) {
      if (!processedForChats.has(row.email)) {
        processedForChats.add(row.email)
        
        const chats = databaseService.getParticipantChat(row.email)
        chats.forEach((c: any) => {
          chatsData.push({
            'Используемые сервисы': row.service || '-',
            'ИНН компании': row.inn || '-',
            'Название компании': row.companyName || '-',
            'Email участника': row.email,
            'Вебинар': c.webinarName || '-',
            'Дата вебинара': c.webinarDate || '-',
            'Время': c.time || '-',
            'Сообщение': c.message || '-'
          })
        })
      }
    }

    const chatsSheet = XLSX.utils.json_to_sheet(chatsData.length > 0 ? chatsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, chatsSheet, 'Чаты')

    // Лист 4: Вопросы
    const questionsData: any[] = []
    const processedForQuestions = new Set<string>()
    
    for (const row of serviceData) {
      if (!processedForQuestions.has(row.email)) {
        processedForQuestions.add(row.email)
        
        const questions = databaseService.getParticipantQuestions(row.email)
        questions.forEach((q: any) => {
          questionsData.push({
            'Используемые сервисы': row.service || '-',
            'ИНН компании': row.inn || '-',
            'Название компании': row.companyName || '-',
            'Email участника': row.email,
            'Вебинар': q.webinarName || '-',
            'Дата вебинара': q.webinarDate || '-',
            'Вопрос': q.question || '-',
            'Статус': q.status || '-',
            'Отвечающий': q.responder || '-',
            'Ответ': q.answer || '-'
          })
        })
      }
    }

    const questionsSheet = XLSX.utils.json_to_sheet(questionsData.length > 0 ? questionsData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Вопросы')

    // Лист 5: Ответы на опросы
    const surveyAnswersData: any[] = []
    const processedForSurveys = new Set<string>()
    
    for (const row of serviceData) {
      if (!processedForSurveys.has(row.email)) {
        processedForSurveys.add(row.email)
        
        const surveyAnswers = databaseService.getParticipantSurveyAnswers(row.email)
        surveyAnswers.forEach((sa: any) => {
          surveyAnswersData.push({
            'Используемые сервисы': row.service || '-',
            'ИНН компании': row.inn || '-',
            'Название компании': row.companyName || '-',
            'Email участника': row.email,
            'Вебинар': sa.webinarName || '-',
            'Дата вебинара': sa.webinarDate || '-',
            'Вопрос опроса': sa.question || '-',
            'Ответ': sa.answer || '-'
          })
        })
      }
    }

    const surveyAnswersSheet = XLSX.utils.json_to_sheet(surveyAnswersData.length > 0 ? surveyAnswersData : [{ 'Сообщение': 'Нет данных' }])
    XLSX.utils.book_append_sheet(workbook, surveyAnswersSheet, 'Ответы на опросы')

    console.log(`Экспорт по сервисам завершён:
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
