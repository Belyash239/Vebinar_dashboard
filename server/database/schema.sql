-- Таблица «Компания»
CREATE TABLE IF NOT EXISTS Компания (
  ID_компании INTEGER PRIMARY KEY AUTOINCREMENT,
  ИНН_компании TEXT UNIQUE NOT NULL,
  Название TEXT
);

-- Таблица «Участники»
CREATE TABLE IF NOT EXISTS Участники (
  ID_участника INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_компании INTEGER,
  Имя TEXT,
  Фамилия TEXT,
  Номер_телефона TEXT,
  FOREIGN KEY (ID_компании) REFERENCES Компания(ID_компании)
);

-- Таблица «Email»
CREATE TABLE IF NOT EXISTS Email (
  ID_email INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_участника INTEGER,
  Email TEXT UNIQUE NOT NULL,
  FOREIGN KEY (ID_участника) REFERENCES Участники(ID_участника)
);

-- Таблица «Вебинары»
CREATE TABLE IF NOT EXISTS Вебинары (
  ID_вебинара INTEGER PRIMARY KEY AUTOINCREMENT,
  Название TEXT NOT NULL,
  Дата TEXT
);

-- Таблица «Тег»
CREATE TABLE IF NOT EXISTS Тег (
  ID_тега INTEGER PRIMARY KEY AUTOINCREMENT,
  Название_тега TEXT UNIQUE NOT NULL
);

-- Таблица «Вебинары-Теги»
CREATE TABLE IF NOT EXISTS "Вебинары-Теги" (
  ID_мероприятия INTEGER,
  ID_тега INTEGER,
  PRIMARY KEY (ID_мероприятия, ID_тега),
  FOREIGN KEY (ID_мероприятия) REFERENCES Вебинары(ID_вебинара),
  FOREIGN KEY (ID_тега) REFERENCES Тег(ID_тега)
);

-- Таблица «Участники-Вебинары»
CREATE TABLE IF NOT EXISTS "Участники-Вебинары" (
  ID_участника INTEGER,
  ID_вебинара INTEGER,
  Имя_в_чате TEXT,
  Компания TEXT,
  Должность TEXT,
  Статус_регистрации TEXT,
  Дата_регистрации TEXT,
  Источники TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  Платформа TEXT,
  Страна TEXT,
  Город TEXT,
  Последний_IP TEXT,
  Время_входа_первое TEXT,
  Время_выхода_последнее TEXT,
  Присутствие_относительно_длительности TEXT,
  Присутствие_от_общей_длительности REAL,
  Кол_во_сообщений INTEGER DEFAULT 0,
  Процент_от_общего_кол_ва_сообщений REAL,
  Кол_во_вопросов INTEGER DEFAULT 0,
  Процент_от_общего_кол_ва_вопросов REAL,
  Количество_поднятых_рук INTEGER DEFAULT 0,
  Количество_отправленных_эмодзи_реакций INTEGER DEFAULT 0,
  PRIMARY KEY (ID_участника, ID_вебинара),
  FOREIGN KEY (ID_участника) REFERENCES Участники(ID_участника),
  FOREIGN KEY (ID_вебинара) REFERENCES Вебинары(ID_вебинара)
);

-- Таблица «Чат»
CREATE TABLE IF NOT EXISTS Чат (
  ID_сообщения INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_вебинара INTEGER,
  ID_email INTEGER,
  Время TEXT,
  Сообщение_чата TEXT,
  FOREIGN KEY (ID_вебинара) REFERENCES Вебинары(ID_вебинара),
  FOREIGN KEY (ID_email) REFERENCES Email(ID_email)
);

-- Таблица «Вопросы»
CREATE TABLE IF NOT EXISTS Вопросы (
  ID_вопроса INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_вебинара INTEGER,
  ID_email INTEGER,
  Автор_вопроса TEXT,
  Вопрос TEXT,
  Статус_вопроса TEXT,
  Отвечающий TEXT,
  Почта_отвечающего TEXT,
  Ответы_и_комментарии TEXT,
  Время_ответа TEXT,
  FOREIGN KEY (ID_вебинара) REFERENCES Вебинары(ID_вебинара),
  FOREIGN KEY (ID_email) REFERENCES Email(ID_email)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_email ON Email(Email);
CREATE INDEX IF NOT EXISTS idx_webinar_date ON Вебинары(Дата);
CREATE INDEX IF NOT EXISTS idx_participant_webinar ON "Участники-Вебинары"(ID_участника, ID_вебинара);
CREATE INDEX IF NOT EXISTS idx_chat_webinar ON Чат(ID_вебинара, Время);
CREATE INDEX IF NOT EXISTS idx_questions_webinar ON Вопросы(ID_вебинара);
