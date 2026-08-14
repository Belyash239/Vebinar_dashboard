// Полный пул полей для маппинга на основе существующих парсеров

export interface FieldMapping {
  dbField: string
  description: string
  possibleNames: string[]
  category: 'participant' | 'webinar' | 'chat' | 'question' | 'survey' | 'attendance'
}

// Маппинг для МТС-линк (основной лист участников)
export const MTS_MAIN_FIELDS: FieldMapping[] = [
  { dbField: 'Email', description: 'Email участника', possibleNames: ['Email', 'email', 'E-mail'], category: 'participant' },
  { dbField: 'Имя', description: 'Имя участника', possibleNames: ['Имя', 'имя'], category: 'participant' },
  { dbField: 'Фамилия', description: 'Фамилия участника', possibleNames: ['Фамилия', 'фамилия'], category: 'participant' },
  { dbField: 'ИНН_компании', description: 'ИНН компании', possibleNames: ['ИНН компании', 'ИНН', 'инн компании'], category: 'participant' },
  { dbField: 'Телефон', description: 'Номер телефона', possibleNames: ['Телефон', 'телефон', 'Номер телефона', 'Мобильный телефон'], category: 'participant' },
  { dbField: 'Компания', description: 'Название компании', possibleNames: ['Компания', 'компания', 'Название компании'], category: 'participant' },
  { dbField: 'Должность', description: 'Должность', possibleNames: ['Должность', 'должность'], category: 'participant' },
  
  { dbField: 'Вебинар', description: 'Название вебинара', possibleNames: ['Вебинар', 'вебинар'], category: 'webinar' },
  { dbField: 'Дата_проведения', description: 'Дата проведения вебинара', possibleNames: ['Дата проведения', 'дата проведения'], category: 'webinar' },
  
  { dbField: 'Имя_в_чате', description: 'Имя в чате', possibleNames: ['Имя в чате', 'имя в чате'], category: 'attendance' },
  { dbField: 'Статус_регистрации', description: 'Статус регистрации', possibleNames: ['Статус регистрации', 'статус регистрации'], category: 'attendance' },
  { dbField: 'Дата_регистрации', description: 'Дата регистрации', possibleNames: ['Дата регистрации', 'дата регистрации'], category: 'attendance' },
  { dbField: 'Источники', description: 'Источники регистрации', possibleNames: ['Источники', 'источники'], category: 'attendance' },
  
  { dbField: 'utm_source', description: 'UTM Source', possibleNames: ['utm_source', 'UTM Source'], category: 'attendance' },
  { dbField: 'utm_medium', description: 'UTM Medium', possibleNames: ['utm_medium', 'UTM Medium'], category: 'attendance' },
  { dbField: 'utm_campaign', description: 'UTM Campaign', possibleNames: ['utm_campaign', 'UTM Campaign'], category: 'attendance' },
  { dbField: 'utm_content', description: 'UTM Content', possibleNames: ['utm_content', 'UTM Content'], category: 'attendance' },
  { dbField: 'utm_term', description: 'UTM Term', possibleNames: ['utm_term', 'UTM Term'], category: 'attendance' },
  { dbField: 'utm_custom', description: 'UTM Custom', possibleNames: ['utm_custom', 'UTM Custom'], category: 'attendance' },
  
  { dbField: 'Платформа', description: 'Платформа', possibleNames: ['Платформа', 'платформа'], category: 'attendance' },
  { dbField: 'Страна', description: 'Страна', possibleNames: ['Страна', 'страна'], category: 'attendance' },
  { dbField: 'Город', description: 'Город', possibleNames: ['Город', 'город'], category: 'attendance' },
  { dbField: 'Последний_IP', description: 'Последний IP', possibleNames: ['Последний IP', 'последний ip'], category: 'attendance' },
  
  { dbField: 'Время_входа_первый', description: 'Время входа (первый)', possibleNames: ['Время входа (первый)', 'время входа (первый)'], category: 'attendance' },
  { dbField: 'Время_выхода_последний', description: 'Время выхода (последний)', possibleNames: ['Время выхода (последний)', 'время выхода (последний)'], category: 'attendance' },
  
  { dbField: 'Присутствие_относительно_длительности', description: 'Присутствие (HH:MM:SS)', possibleNames: [
    'Присутствие относительно длительности мероприятия, чч:мм:сс',
    'Присутствие относительно длительности   мероприятия, чч:мм:сс',
    'Присутствие относительно длительности мероприятия'
  ], category: 'attendance' },
  
  { dbField: 'Присутствие_от_общей_длительности', description: 'Присутствие (%)', possibleNames: [
    'Присутствие от общей длительности мероприятия',
    'Присутствие от общей длительности   мероприятия'
  ], category: 'attendance' },
  
  { dbField: 'Кол_во_сообщений', description: 'Количество сообщений', possibleNames: ['Кол-во сообщений', 'кол-во сообщений'], category: 'attendance' },
  { dbField: 'Процент_от_общего_кол_ва_сообщений', description: '% от общего кол-ва сообщений', possibleNames: ['Процент от общего кол-ва сообщений'], category: 'attendance' },
  { dbField: 'Кол_во_вопросов', description: 'Количество вопросов', possibleNames: ['Кол-во вопросов', 'кол-во вопросов'], category: 'attendance' },
  { dbField: 'Процент_от_общего_кол_ва_вопросов', description: '% от общего кол-ва вопросов', possibleNames: ['Процент от общего кол-ва вопросов'], category: 'attendance' },
  { dbField: 'Количество_поднятых_рук', description: 'Количество поднятых рук', possibleNames: ['Количество поднятых рук'], category: 'attendance' },
  { dbField: 'Количество_отправленных_эмодзи_реакций', description: 'Количество эмодзи', possibleNames: ['Количество отправленных эмодзи реакций'], category: 'attendance' }
]

// Маппинг для МТС-линк (вопросы)
export const MTS_QUESTIONS_FIELDS: FieldMapping[] = [
  { dbField: 'Почта_автора_вопроса', description: 'Email автора вопроса', possibleNames: ['Почта автора вопроса', 'почта автора вопроса'], category: 'question' },
  { dbField: 'Вопрос', description: 'Текст вопроса', possibleNames: ['Вопрос', 'вопрос'], category: 'question' },
  { dbField: 'Статус_вопроса', description: 'Статус вопроса', possibleNames: ['Статус вопроса', 'статус вопроса', 'Статус'], category: 'question' },
  { dbField: 'Отвечающий', description: 'Отвечающий', possibleNames: ['Отвечающий', 'отвечающий'], category: 'question' },
  { dbField: 'Почта_отвечающего', description: 'Email отвечающего', possibleNames: ['Почта отвечающего', 'почта отвечающего'], category: 'question' },
  { dbField: 'Ответы_и_комментарии', description: 'Ответы и комментарии', possibleNames: ['Ответы и комментарии', 'ответы и комментарии', 'Ответ'], category: 'question' },
  { dbField: 'Время_ответа', description: 'Время ответа', possibleNames: ['Время ответа', 'время ответа'], category: 'question' }
]

// Маппинг для МТС-линк (чат)
export const MTS_CHAT_FIELDS: FieldMapping[] = [
  { dbField: 'Email_участника', description: 'Email участника', possibleNames: ['Email участника', 'email участника', 'Email', 'email'], category: 'chat' },
  { dbField: 'Время', description: 'Время сообщения', possibleNames: ['Время', 'время'], category: 'chat' },
  { dbField: 'Сообщение_чата', description: 'Текст сообщения', possibleNames: ['Сообщение чата', 'Сообщение', 'message'], category: 'chat' }
]

// Маппинг для МТС-линк (опросы)
export const MTS_SURVEY_FIELDS: FieldMapping[] = [
  { dbField: 'Email', description: 'Email участника', possibleNames: ['Email', 'email', 'E-mail'], category: 'survey' },
  { dbField: 'Участник', description: 'Имя участника', possibleNames: ['Участник', 'участник'], category: 'survey' }
  // + динамические поля вопросов
]

// Маппинг для Proofix (регистрации)
export const PROOFIX_REGISTRATION_FIELDS: FieldMapping[] = [
  { dbField: 'Email', description: 'Email участника', possibleNames: ['Email', 'email', 'E-mail'], category: 'participant' },
  { dbField: 'Имя', description: 'Имя', possibleNames: ['Имя', 'имя'], category: 'participant' },
  { dbField: 'Фамилия', description: 'Фамилия', possibleNames: ['Фамилия', 'фамилия'], category: 'participant' },
  { dbField: 'Телефон', description: 'Телефон', possibleNames: ['Телефон', 'телефон'], category: 'participant' },
  { dbField: 'ИНН', description: 'ИНН', possibleNames: ['ИНН', 'инн'], category: 'participant' },
  { dbField: 'Дата_создания', description: 'Дата создания', possibleNames: ['Дата создания', 'дата создания'], category: 'participant' },
  { dbField: 'Utm_метки', description: 'UTM метки', possibleNames: ['Utm метки', 'utm метки', 'UTM метки'], category: 'attendance' },
  { dbField: 'Источник', description: 'Источник', possibleNames: ['Источник', 'источник'], category: 'attendance' }
]

// Маппинг для Proofix (присутствие)
export const PROOFIX_ATTENDANCE_FIELDS: FieldMapping[] = [
  { dbField: 'Email', description: 'Email участника', possibleNames: ['Email', 'email'], category: 'participant' },
  { dbField: 'Имя', description: 'Имя', possibleNames: ['Имя', 'имя'], category: 'participant' },
  { dbField: 'Фамилия', description: 'Фамилия', possibleNames: ['Фамилия', 'фамилия'], category: 'participant' },
  { dbField: 'Телефон', description: 'Телефон', possibleNames: ['Телефон', 'телефон'], category: 'participant' },
  { dbField: 'ИНН', description: 'ИНН', possibleNames: ['ИНН', 'инн'], category: 'participant' },
  { dbField: 'Дата_создания', description: 'Дата создания', possibleNames: ['Дата создания', 'дата создания'], category: 'attendance' },
  { dbField: 'Продолжительность_присутствия_минут', description: 'Продолжительность присутствия (минуты)', possibleNames: [
    'Продолжительность присутствия участника,   минут',
    'Продолжительность присутствия участника, минут',
    'Продолжительность присутствия участника'
  ], category: 'attendance' },
  { dbField: 'Продолжительность_активная_вкладка_минут', description: 'Активная вкладка (минуты)', possibleNames: [
    'Продолжительность присутствия участника активная вкладка, минут'
  ], category: 'attendance' },
  { dbField: 'Кол_во_подтверждений_контроля', description: 'Подтверждения контроля присутствия', possibleNames: [
    'Кол-во подтверждений Контроля присутствия'
  ], category: 'attendance' },
  { dbField: 'Utm_метки', description: 'UTM метки', possibleNames: ['Utm метки', 'utm метки'], category: 'attendance' }
]

// Маппинг для Proofix (чат)
export const PROOFIX_CHAT_FIELDS: FieldMapping[] = [
  { dbField: 'ID_сообщения', description: 'ID сообщения', possibleNames: ['ID_сообщения', 'ID сообщения'], category: 'chat' },
  { dbField: 'ID_сообщения_родителя', description: 'ID родительского сообщения', possibleNames: ['ID-сообщения родителя', 'ID_сообщения_родителя'], category: 'chat' },
  { dbField: 'Дата_создания', description: 'Дата создания', possibleNames: ['Дата создания', 'дата создания'], category: 'chat' },
  { dbField: 'Сообщение', description: 'Текст сообщения', possibleNames: ['Сообщение', 'сообщение'], category: 'chat' },
  { dbField: 'email_участника_мероприятия', description: 'Email участника', possibleNames: ['email участника мероприятия', 'Email участника'], category: 'chat' },
  { dbField: 'Имя_участника_в_чате', description: 'Имя в чате', possibleNames: ['Имя участника в чате'], category: 'chat' },
  { dbField: 'Код_участника', description: 'Код участника', possibleNames: ['Код участника'], category: 'chat' },
  { dbField: 'Кол_во_лайков', description: 'Количество лайков', possibleNames: ['Кол-во лайков сообщения'], category: 'chat' },
  { dbField: 'Кол_во_дизлайков', description: 'Количество дизлайков', possibleNames: ['Кол-во диз лайков сообщения', 'Кол-во дизлайков сообщения'], category: 'chat' },
  { dbField: 'IP_адрес', description: 'IP адрес', possibleNames: ['IP-адрес c которого отправлено сообщение', 'IP-адрес'], category: 'chat' }
]

// Маппинг для Proofix (опросы)
export const PROOFIX_SURVEY_FIELDS: FieldMapping[] = [
  { dbField: 'Имя', description: 'Имя', possibleNames: ['Имя', 'имя'], category: 'survey' },
  { dbField: 'Фамилия', description: 'Фамилия', possibleNames: ['Фамилия', 'фамилия'], category: 'survey' },
  { dbField: 'Email', description: 'Email', possibleNames: ['Email', 'email', 'E-mail'], category: 'survey' },
  { dbField: 'Телефон', description: 'Телефон', possibleNames: ['Телефон', 'телефон'], category: 'survey' },
  { dbField: 'ИНН', description: 'ИНН', possibleNames: ['ИНН', 'инн'], category: 'survey' },
  { dbField: 'Дата_создания', description: 'Дата создания', possibleNames: ['Дата создания', 'дата создания'], category: 'survey' },
  { dbField: 'Последний_вход', description: 'Последний вход', possibleNames: ['Последний вход', 'последний вход'], category: 'survey' }
  // + динамические поля вопросов
]

// Универсальный пул полей БД (строго по схеме БД, сгруппировано по таблицам)
export const UNIQUE_FIELDS_POOL: FieldMapping[] = [
  // Таблица «Компания»
  { dbField: 'ID_компании', description: 'ID компании', possibleNames: [], category: 'participant' },
  { dbField: 'ИНН_компании', description: 'ИНН компании', possibleNames: ['ИНН компании', 'ИНН', 'инн компании', 'инн'], category: 'participant' },
  { dbField: 'Название', description: 'Название компании', possibleNames: ['Компания', 'компания', 'Название компании', 'Название'], category: 'participant' },
  
  // Таблица «Участники»
  { dbField: 'ID_участника', description: 'ID участника', possibleNames: [], category: 'participant' },
  { dbField: 'ID_компании', description: 'ID компании (FK)', possibleNames: [], category: 'participant' },
  { dbField: 'Имя', description: 'Имя', possibleNames: ['Имя', 'имя'], category: 'participant' },
  { dbField: 'Фамилия', description: 'Фамилия', possibleNames: ['Фамилия', 'фамилия'], category: 'participant' },
  { dbField: 'Номер_телефона', description: 'Номер телефона', possibleNames: ['Телефон', 'телефон', 'Номер телефона', 'Мобильный телефон'], category: 'participant' },
  { dbField: 'Должность', description: 'Должность', possibleNames: ['Должность', 'должность'], category: 'participant' },
  
  // Таблица «Email»
  { dbField: 'ID_email', description: 'ID email', possibleNames: [], category: 'participant' },
  { dbField: 'Email', description: 'Email', possibleNames: ['Email', 'email', 'E-mail'], category: 'participant' },
  
  // Таблица «Вебинары»
  { dbField: 'ID_вебинара', description: 'ID вебинара', possibleNames: [], category: 'webinar' },
  { dbField: 'Название_вебинара', description: 'Название вебинара', possibleNames: ['Вебинар', 'вебинар', 'Название'], category: 'webinar' },
  { dbField: 'Дата', description: 'Дата', possibleNames: ['Дата проведения', 'дата проведения', 'Дата'], category: 'webinar' },
  
  // Таблица «Тег»
  { dbField: 'ID_тега', description: 'ID тега', possibleNames: [], category: 'webinar' },
  { dbField: 'Название_тега', description: 'Название тега', possibleNames: [], category: 'webinar' },
  
  // Таблица «Участники-Вебинары»
  { dbField: 'Имя_в_чате', description: 'Имя в чате', possibleNames: ['Имя в чате', 'имя в чате', 'Имя участника в чате'], category: 'attendance' },
  { dbField: 'Компания', description: 'Компания', possibleNames: ['Компания', 'компания'], category: 'attendance' },
  { dbField: 'Статус_регистрации', description: 'Статус регистрации', possibleNames: ['Статус регистрации', 'статус регистрации'], category: 'attendance' },
  { dbField: 'Дата_регистрации', description: 'Дата регистрации', possibleNames: ['Дата регистрации', 'дата регистрации', 'Дата создания', 'дата создания'], category: 'attendance' },
  { dbField: 'Источники', description: 'Источники', possibleNames: ['Источники', 'источники', 'Источник', 'источник'], category: 'attendance' },
  { dbField: 'utm_source', description: 'utm_source', possibleNames: ['utm_source', 'UTM Source'], category: 'attendance' },
  { dbField: 'utm_medium', description: 'utm_medium', possibleNames: ['utm_medium', 'UTM Medium'], category: 'attendance' },
  { dbField: 'utm_campaign', description: 'utm_campaign', possibleNames: ['utm_campaign', 'UTM Campaign'], category: 'attendance' },
  { dbField: 'utm_content', description: 'utm_content', possibleNames: ['utm_content', 'UTM Content'], category: 'attendance' },
  { dbField: 'utm_term', description: 'utm_term', possibleNames: ['utm_term', 'UTM Term'], category: 'attendance' },
  { dbField: 'utm_custom', description: 'utm_custom', possibleNames: ['utm_custom', 'UTM Custom'], category: 'attendance' },
  { dbField: 'Платформа', description: 'Платформа', possibleNames: ['Платформа', 'платформа'], category: 'attendance' },
  { dbField: 'Страна', description: 'Страна', possibleNames: ['Страна', 'страна'], category: 'attendance' },
  { dbField: 'Город', description: 'Город', possibleNames: ['Город', 'город'], category: 'attendance' },
  { dbField: 'Последний_IP', description: 'Последний IP', possibleNames: ['Последний IP', 'последний ip', 'IP-адрес', 'IP-адрес c которого отправлено сообщение'], category: 'attendance' },
  { dbField: 'Время_входа_первое', description: 'Время входа первое', possibleNames: ['Время входа (первый)', 'время входа (первый)', 'Время входа первое'], category: 'attendance' },
  { dbField: 'Время_выхода_последнее', description: 'Время выхода последнее', possibleNames: ['Время выхода (последний)', 'время выхода (последний)', 'Время выхода последнее'], category: 'attendance' },
  { dbField: 'Присутствие_относительно_длительности', description: 'Присутствие относительно длительности', possibleNames: [
    'Присутствие относительно длительности мероприятия, чч:мм:сс',
    'Присутствие относительно длительности   мероприятия, чч:мм:сс',
    'Присутствие относительно длительности мероприятия',
    'Продолжительность присутствия участника,   минут',
    'Продолжительность присутствия участника, минут',
    'Продолжительность присутствия участника'
  ], category: 'attendance' },
  { dbField: 'Присутствие_от_общей_длительности', description: 'Присутствие от общей длительности', possibleNames: [
    'Присутствие от общей длительности мероприятия',
    'Присутствие от общей длительности   мероприятия'
  ], category: 'attendance' },
  { dbField: 'Кол_во_сообщений', description: 'Кол-во сообщений', possibleNames: ['Кол-во сообщений', 'кол-во сообщений'], category: 'attendance' },
  { dbField: 'Процент_от_общего_кол_ва_сообщений', description: 'Процент от общего кол-ва сообщений', possibleNames: ['Процент от общего кол-ва сообщений'], category: 'attendance' },
  { dbField: 'Кол_во_вопросов', description: 'Кол-во вопросов', possibleNames: ['Кол-во вопросов', 'кол-во вопросов'], category: 'attendance' },
  { dbField: 'Процент_от_общего_кол_ва_вопросов', description: 'Процент от общего кол-ва вопросов', possibleNames: ['Процент от общего кол-ва вопросов'], category: 'attendance' },
  { dbField: 'Количество_поднятых_рук', description: 'Количество поднятых рук', possibleNames: ['Количество поднятых рук'], category: 'attendance' },
  { dbField: 'Количество_отправленных_эмодзи_реакций', description: 'Количество эмодзи реакций', possibleNames: ['Количество отправленных эмодзи реакций'], category: 'attendance' },
  
  // Таблица «Чат»
  { dbField: 'ID_сообщения', description: 'ID сообщения', possibleNames: ['ID_сообщения', 'ID сообщения'], category: 'chat' },
  { dbField: 'Время', description: 'Время', possibleNames: ['Время', 'время', 'Дата создания'], category: 'chat' },
  { dbField: 'Сообщение_чата', description: 'Сообщение чата', possibleNames: ['Сообщение чата', 'Сообщение', 'сообщение', 'message'], category: 'chat' },
  
  // Таблица «Вопросы»
  { dbField: 'ID_вопроса', description: 'ID вопроса', possibleNames: [], category: 'question' },
  { dbField: 'Автор_вопроса', description: 'Автор вопроса', possibleNames: ['Автор вопроса', 'автор вопроса', 'Почта автора вопроса', 'почта автора вопроса'], category: 'question' },
  { dbField: 'Вопрос', description: 'Вопрос', possibleNames: ['Вопрос', 'вопрос'], category: 'question' },
  { dbField: 'Статус_вопроса', description: 'Статус вопроса', possibleNames: ['Статус вопроса', 'статус вопроса', 'Статус'], category: 'question' },
  { dbField: 'Отвечающий', description: 'Отвечающий', possibleNames: ['Отвечающий', 'отвечающий'], category: 'question' },
  { dbField: 'Почта_отвечающего', description: 'Почта отвечающего', possibleNames: ['Почта отвечающего', 'почта отвечающего'], category: 'question' },
  { dbField: 'Ответы_и_комментарии', description: 'Ответы и комментарии', possibleNames: ['Ответы и комментарии', 'ответы и комментарии', 'Ответ'], category: 'question' },
  { dbField: 'Время_ответа', description: 'Время ответа', possibleNames: ['Время ответа', 'время ответа'], category: 'question' },
  
  // Таблица «Опросы»
  { dbField: 'Вопрос_опроса', description: 'Вопрос опроса', possibleNames: ['Вопрос', 'вопрос'], category: 'survey' },
  { dbField: 'ID_опроса', description: 'ID опроса', possibleNames: [], category: 'survey' },
  
  // Таблица «Опросы-Email»
  { dbField: 'Ответ', description: 'Ответ', possibleNames: ['Ответ', 'ответ'], category: 'survey' }
]

// Функция автоматического маппинга
export function autoMapColumns(columns: string[], format: 'mts' | 'proofix'): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  for (const field of UNIQUE_FIELDS_POOL) {
    for (const possibleName of field.possibleNames) {
      if (columns.includes(possibleName)) {
        mapping[field.dbField] = possibleName
        break
      }
    }
  }
  
  return mapping
}

// Определение формата по колонкам
export function detectFormat(columns: string[]): 'mts' | 'proofix' {
  // МТС-линк имеет много специфичных колонок
  const mtsSpecificColumns = [
    'Присутствие относительно длительности мероприятия, чч:мм:сс',
    'Процент от общего кол-ва сообщений',
    'Количество поднятых рук'
  ]
  
  const hasMtsColumns = mtsSpecificColumns.some(col => 
    columns.some(c => c.includes(col.substring(0, 20)))
  )
  
  if (hasMtsColumns) return 'mts'
  
  // Proofix имеет меньше колонок и специфичные поля
  const proofixSpecificColumns = [
    'Utm метки',
    'Продолжительность присутствия участника,   минут',
    'ID_сообщения'
  ]
  
  const hasProofixColumns = proofixSpecificColumns.some(col => columns.includes(col))
  
  if (hasProofixColumns) return 'proofix'
  
  // По умолчанию по количеству колонок
  return columns.length > 15 ? 'mts' : 'proofix'
}

// Определение типа файла по колонкам
export function detectFileType(columns: string[]): 'main' | 'questions' | 'chat' | 'survey' | 'attendance' | 'unknown' {
  // МТС-линк: основной лист
  const mtsMainIndicators = [
    'Присутствие относительно длительности мероприятия',
    'Статус регистрации',
    'Количество поднятых рук',
    'Платформа'
  ]
  if (mtsMainIndicators.some(ind => columns.some(col => col.includes(ind)))) {
    return 'main'
  }
  
  // МТС-линк: вопросы
  const mtsQuestionsIndicators = [
    'Почта автора вопроса',
    'Статус вопроса',
    'Ответы и комментарии'
  ]
  if (mtsQuestionsIndicators.some(ind => columns.includes(ind))) {
    return 'questions'
  }
  
  // МТС-линк или Proofix: чат
  const chatIndicators = [
    'Сообщение чата',
    'ID_сообщения',
    'Кол-во лайков сообщения',
    'email участника мероприятия'
  ]
  if (chatIndicators.some(ind => columns.some(col => col.includes(ind)))) {
    return 'chat'
  }
  
  // Proofix: присутствие
  const attendanceIndicators = [
    'Продолжительность присутствия участника,   минут',
    'Кол-во подтверждений Контроля присутствия'
  ]
  if (attendanceIndicators.some(ind => columns.some(col => col.includes(ind)))) {
    return 'attendance'
  }
  
  // Опросы (и МТС-линк и Proofix) - проверяем ПЕРЕД регистрациями
  // МТС-линк опросы: есть Email, Участник, и много других колонок с вопросами
  // Ключевой признак - нет стандартных полей основного листа
  const surveyIndicators = [
    'Участник', // Есть в опросах МТС-линк
    'Последний вход' // Есть в опросах Proofix
  ]
  
  // Проверяем, что есть Email и Участник, но НЕТ полей основного листа
  const hasEmail = columns.some(col => col.toLowerCase() === 'email' || col.toLowerCase() === 'e-mail')
  const hasSurveyMarkers = surveyIndicators.some(ind => columns.includes(ind))
  const hasMainMarkers = mtsMainIndicators.some(ind => columns.some(col => col.includes(ind)))
  
  if (hasEmail && hasSurveyMarkers && !hasMainMarkers) {
    return 'survey'
  }
  
  // Proofix: регистрации (если есть Utm метки и мало колонок)
  if (columns.includes('Utm метки') && columns.length < 15 && !hasMainMarkers) {
    return 'main'
  }
  
  // По умолчанию - основной файл если есть Email
  if (hasEmail && columns.length > 5) {
    return 'main'
  }
  
  return 'unknown'
}

