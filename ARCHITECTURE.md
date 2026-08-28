# Архитектура системы "Анализ участников вебинаров"

## Обзор

Система для аналитики участников вебинаров МТС-Линк и Proofix с функциями импорта данных, обогащения через DaData API и визуализации статистики.

## Технологический стек

### Frontend
- **Vue 3** - UI framework
- **TypeScript** - типизация
- **Chart.js** - графики и визуализация
- **Vue Router** - маршрутизация

### Backend
- **Node.js + Express** - REST API сервер
- **TypeScript** - типизация
- **better-sqlite3** - база данных (SQLite)
- **ExcelJS** - работа с Excel файлами (потоковая обработка)
- **XLSX** - парсинг Excel
- **Multer** - загрузка файлов
- **node-fetch** - HTTP-клиент для DaData API

### Инфраструктура
- **Vite** - сборка frontend
- **tsx** - запуск TypeScript
- **Vitest** - тестирование

---

## Архитектура компонентов

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vue 3)                      │
├─────────────────────────────────────────────────────────────┤
│  Pages:                                                      │
│  ├─ HomePage          - Главная (графики, статистика)       │
│  ├─ DashboardPage     - Список компаний                     │
│  ├─ CompanyDetailPage - Детали компании                     │
│  ├─ WebinarDetailPage - Детали вебинара                     │
│  └─ ParticipantDetailPage - Детали участника                │
│                                                              │
│  Features:                                                   │
│  ├─ ImportModal           - Импорт основного файла          │
│  ├─ BulkImportModal       - Импорт больших файлов           │
│  ├─ SurveyImportModal     - Импорт опросов                  │
│  └─ DaDataSettingsModal   - Настройки обогащения            │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP (REST API)
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Express + Node.js)               │
├─────────────────────────────────────────────────────────────┤
│  API Endpoints (server/index.ts):                           │
│  ├─ POST /api/upload         - Загрузка файлов              │
│  ├─ POST /api/upload-bulk    - Загрузка больших файлов      │
│  ├─ GET  /api/webinars       - Список вебинаров             │
│  ├─ GET  /api/companies      - Список компаний              │
│  ├─ GET  /api/participants   - Список участников            │
│  ├─ GET  /api/export         - Экспорт данных               │
│  └─ GET  /api/dadata/*       - Управление DaData            │
│                                                              │
│  Services:                                                   │
│  ├─ parser.service.ts        - Парсинг Excel файлов         │
│  ├─ database.service.ts      - Работа с БД                  │
│  ├─ dadata.service.ts        - Обогащение через DaData      │
│  ├─ dadata-scheduler.service.ts - Планировщик обогащения    │
│  ├─ export.service.ts        - Экспорт данных               │
│  └─ field-mappings.ts        - Маппинг полей                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite)                         │
│                    webinars.db                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL API (DaData)                       │
│          https://dadata.ru/api/                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Модули и их связи

### 1. Parser Service (`server/services/parser.service.ts`)

**Назначение**: Парсинг Excel файлов различных форматов.

**Основные методы**:
- `parseMainFile()` - парсинг основного файла МТС-Линк
- `parseBulkFile()` - парсинг больших файлов с маппингом
- `parseBulkFileStreaming()` - потоковый парсинг (300K+ строк)
- `parseSurveyFile()` - парсинг опросов
- `parseChatFile()` - парсинг чата
- `parseQuestionsFile()` - парсинг вопросов
- `parseProofixMainFile()` - парсинг Proofix регистраций
- `parseProofixAttendanceFile()` - парсинг Proofix присутствия
- `readExcelColumns()` - чтение колонок для маппинга
- `detectFileTypeBySheets()` - автоопределение типа файла

**Зависимости**:
- `database.service.ts` - сохранение данных
- `field-mappings.ts` - автоматический маппинг полей
- `XLSX` - парсинг Excel
- `ExcelJS` - потоковая обработка

**Особенности**:
- Поддержка форматов: МТС-Линк, Proofix
- Обработка Excel serial dates
- Валидация ИНН (10/12 цифр)
- Игнорирование гостей (email содержит "гость")
- Потоковая обработка для больших файлов

---

### 2. Database Service (`server/database/database.service.ts`)

**Назначение**: Работа с SQLite базой данных.

**Основные методы**:

**Вебинары**:
- `getOrCreateWebinar()` - создание/получение вебинара
- `getAllWebinars()` - список всех вебинаров
- `getWebinarById()` - получение по ID

**Участники**:
- `getOrCreateParticipantByEmail()` - создание/получение участника
- `addParticipantWebinar()` - связь участник-вебинар
- `getAllParticipants()` - список участников

**Компании**:
- `getOrCreateCompany()` - создание/получение компании
- `getAllCompanies()` - список компаний
- `getCompaniesByInns()` - получение по массиву ИНН
- `updateCompanyFromDaData()` - обновление данными DaData

**Опросы**:
- `addSurveyQuestion()` - добавление вопроса опроса
- `getAllSurveys()` - список опросов

**Чат и вопросы**:
- `addChatMessage()` - сообщение чата
- `addQuestion()` - вопрос к вебинару

**Зависимости**:
- `better-sqlite3` - SQLite драйвер

**Особенности**:
- Игнор-лист ИНН: `4027145240`, `4029017981`
- Игнорирование гостей (email с "гость")
- Транзакции для batch операций
- WAL режим для производительности

---

### 3. DaData Service (`server/services/dadata.service.ts`)

**Назначение**: Обогащение данных компаний через DaData API.

**Основные методы**:
- `getCompanyByInn()` - получение данных по ИНН
- `getCompaniesByInnBatch()` - batch запрос с rate limiting

**Возвращаемые данные**:
- Название компании (короткое/полное)
- КПП, ОГРН
- ОКВЭД (основной + дополнительные)
- Тип организации (ЮЛ/ИП)
- ОПФ (организационно-правовая форма)
- Система налогообложения (УСН, ЕСХН, и др.)
- Статус (Действующая, Ликвидирована, и др.)
- Доходы/расходы

**Зависимости**:
- `node-fetch` - HTTP клиент
- `.env` - API ключ

**Особенности**:
- HTTP Agent с keepalive (переиспользование соединений)
- Rate limiting: 20 запросов/сек (задержка 50 мс)
- Connection pooling (макс. 5 соединений)
- Избегание блокировки (лимит 60 новых соединений/мин)

**Конфигурация** (`.env`):
```env
DADATA_API_KEY=your_key
```

---

### 4. DaData Scheduler Service (`server/services/dadata-scheduler.service.ts`)

**Назначение**: Автоматическое обогащение данных компаний.

**Основные методы**:
- `start()` - запуск планировщика
- `stop()` - остановка
- `enrichNow()` - запуск вручную
- `getConfig()` - получение конфига
- `updateConfig()` - обновление конфига
- `getState()` - состояние (счётчик запросов)

**Логика работы**:
1. Запускается каждые N часов (настраивается)
2. Выбирает компании для обогащения:
   - Без данных DaData
   - Или данные старше 30 дней
3. Приоритет: компании из последнего вебинара
4. Batch обработка с соблюдением дневного лимита
5. Сброс счётчика в 00:00 по МСК

**Конфигурация** (`.env`):
```env
DADATA_ENABLED=true
DADATA_INTERVAL_HOURS=12
DADATA_BATCH_SIZE=200
DADATA_PRIORITIZE_LATEST_WEBINAR=true
DADATA_DAILY_LIMIT=1000
```

**State** (`server/config/dadata-state.json`):
```json
{
  "lastRun": "2026-08-27T21:53:25.793Z",
  "todayCount": 4288,
  "lastResetDate": "2026-08-27"
}
```

**Зависимости**:
- `dadata.service.ts` - API запросы
- `database.service.ts` - получение/обновление компаний

---

### 5. Export Service (`server/services/export.service.ts`)

**Назначение**: Экспорт данных в Excel.

**Основные методы**:
- `exportToExcel()` - экспорт с фильтрами

**Фильтры**:
- По вебинару
- По году
- По должности
- По статусу регистрации
- По компании

**Формат экспорта**:
- Один лист с полными данными
- Колонки: участник, email, компания, вебинар, даты, статистика

**Зависимости**:
- `ExcelJS` - создание Excel файлов
- `database.service.ts` - получение данных

---

### 6. Field Mappings (`server/services/field-mappings.ts`)

**Назначение**: Автоматический маппинг полей Excel → БД.

**Функции**:
- `autoMapColumns()` - автоматическое сопоставление
- `UNIQUE_FIELDS_POOL` - пул известных полей

**Алгоритм**:
1. Нормализация названий (lowercase, trim)
2. Точное совпадение
3. Fuzzy matching (по подстроке)
4. Возврат маппинга с confidence score

**Поддерживаемые поля**:
- Email, Имя, Фамилия
- ИНН, КПП, ОГРН
- Компания, Должность
- Вебинар, Дата проведения
- Статус регистрации
- Время входа/выхода
- Присутствие (относительно/процент)
- Количество сообщений/вопросов
- UTM метки

---

## База данных

### Схема (`server/database/schema.sql`)

**Таблицы**:

1. **Вебинары** - информация о вебинарах
2. **Участники** - участники (уникальность по ID)
3. **Email** - email адреса (уникальность по email)
4. **Компании** - компании (уникальность по ИНН)
5. **Участники-Вебинары** - связь многие-ко-многим
6. **Опросы** - опросные листы
7. **Вопросы_опросов** - вопросы и ответы
8. **Вопросы** - вопросы к вебинарам
9. **Чат** - сообщения чата
10. **Теги** - теги для вебинаров
11. **Вебинары-Теги** - связь вебинары-теги

**Ключевые связи**:
```
Участники ←→ Email (1:1)
Участники ←→ Компании (N:1)
Участники ←→ Вебинары (N:M через Участники-Вебинары)
Вебинары ←→ Теги (N:M через Вебинары-Теги)
Опросы ←→ Вебинары (N:1, опционально)
```

---

## Frontend страницы

### HomePage (`src/pages/home/ui/HomePage.vue`)

**Функции**:
- График роста базы участников по годам
- Фильтр по нескольким годам (checkbox dropdown)
- Статистика: всего участников, компаний, вебинаров

### DashboardPage (`src/pages/dashboard/ui/DashboardPage.vue`)

**Функции**:
- Таблица компаний с данными DaData
- Фильтры по статусу, системе налогообложения
- Пагинация
- Переход к деталям компании

### CompanyDetailPage (`src/pages/company-detail/ui/CompanyDetailPage.vue`)

**Функции**:
- Полная информация о компании
- Список вебинаров компании
- Список участников из компании

### WebinarDetailPage (`src/pages/webinar-detail/ui/WebinarDetailPage.vue`)

**Функции**:
- Информация о вебинаре
- Список участников
- Статистика присутствия

### ParticipantDetailPage (`src/pages/participant-detail/ui/ParticipantDetailPage.vue`)

**Функции**:
- Информация об участнике
- История вебинаров
- Статистика активности

---

## Модальные окна

### ImportModal (`src/features/upload-files/ui/ImportModal.vue`)

**Функции**:
- Загрузка основного файла (участники + вебинар)
- Выбор листов Excel
- Выбор дополнительных файлов (вопросы, чат, опросы)
- Выбор формата (МТС-Линк / Proofix)

### BulkImportModal (`src/features/upload-files/ui/BulkImportModal.vue`)

**Функции**:
- Загрузка больших файлов (300K+ строк)
- Автоматический/ручной маппинг полей
- Предпросмотр данных
- Потоковая обработка

### SurveyImportModal (`src/features/upload-files/ui/SurveyImportModal.vue`)

**Функции**:
- Импорт опросов
- Опциональная привязка к вебинару
- Импорт должностей из опросов

### DaDataSettingsModal (`src/features/upload-files/ui/DaDataSettingsModal.vue`)

**Функции**:
- Настройка автообогащения
- Просмотр статистики (использовано/лимит)
- Запуск обогащения вручную
- Включение/отключение планировщика

---

## Scripts (утилиты)

### `scripts/add-tags-streaming.ts`
Добавление тегов к большому файлу экспорта (361K строк) с потоковой обработкой.

### `scripts/convert-dates-in-export.ts`
Конвертация Excel serial dates в читаемый текстовый формат.

### `scripts/enrich-companies.ts`
Ручной запуск обогащения компаний через DaData.

### `scripts/preview-files.ts`
Предпросмотр содержимого Excel файлов.

---

## Конфигурация

### `.env`
```env
# DaData API
DADATA_API_KEY=your_key

# DaData Enrichment
DADATA_ENABLED=true
DADATA_INTERVAL_HOURS=12
DADATA_BATCH_SIZE=200
DADATA_PRIORITIZE_LATEST_WEBINAR=true
DADATA_DAILY_LIMIT=1000
```

### `server/config/dadata-state.json`
```json
{
  "lastRun": "2026-08-27T21:53:25.793Z",
  "todayCount": 4288,
  "lastResetDate": "2026-08-27"
}
```

---

## Потоки данных

### 1. Импорт основного файла
```
User → ImportModal → POST /api/upload 
  → ParserService.parseMainFile()
  → DatabaseService (create webinar, participants, companies)
  → Response (webinar created)
```

### 2. Импорт большого файла
```
User → BulkImportModal → POST /api/upload-bulk
  → ParserService.parseBulkFileStreaming()
  → DatabaseService (batch insert with transactions)
  → Progress updates
  → Response (success)
```

### 3. Обогащение DaData (автоматическое)
```
Scheduler (every 12h) → getCompaniesToEnrich()
  → DaDataService.getCompaniesByInnBatch()
  → DatabaseService.updateCompanyFromDaData()
  → Save state (increment counter)
```

### 4. Экспорт данных
```
User → GET /api/export?filters
  → DatabaseService (query with filters)
  → ExportService.exportToExcel()
  → Response (Excel file download)
```

---

## Производительность

### Импорт больших файлов
- **Потоковая обработка**: ExcelJS streaming API
- **Batch insert**: 1000 записей за транзакцию
- **Периодическое сохранение**: каждые 1000 строк
- **Результат**: 361K строк за ~2-3 минуты

### DaData запросы
- **Rate limiting**: 20 запросов/сек (50 мс задержка)
- **Connection pooling**: до 5 соединений с keepalive
- **Batch**: 200 компаний за ~10 секунд
- **Дневной лимит**: 1000 запросов

### База данных
- **WAL режим**: параллельные чтения
- **Индексы**: на ИНН, Email, даты
- **Транзакции**: для batch операций
- **Размер**: ~50 MB для 361K записей

---

## Безопасность

### Игнор-лист ИНН
```typescript
const ignoredInns = ['4027145240', '4029017981']
```

### Игнорирование гостей
```typescript
if (email.toLowerCase().includes('гость')) {
  return null // Не создаём участника
}
```

### Валидация ИНН
```typescript
if (!/^\d{10}$|^\d{12}$/.test(inn)) {
  return null // Только 10 или 12 цифр
}
```

### API ключи
- Хранятся в `.env` (не в git)
- `.env.example` с placeholder значениями

---

## Тестирование

### Unit тесты (`tests/`)
- `survey-import.test.ts` - тесты импорта опросов
- `unified-import.test.ts` - тесты унифицированного импорта

### Запуск тестов
```bash
npm run test
npm run test:ui  # UI режим
```

---

## Deployment

### Сборка
```bash
npm run build  # Frontend
```

### Запуск
```bash
npm run dev:server  # Backend (development)
npm run dev         # Frontend (development)
```

### Production
```bash
# Backend
node server/index.js

# Frontend
npm run build && npm run preview
```

---

## Поддержка

### Логирование
- Консольные логи с эмодзи для читаемости
- Прогресс импорта (каждые 5000/10000 строк)
- Статистика обогащения DaData

### Отладка
- `scripts/preview-files.ts` - просмотр Excel
- `scripts/check-column-types.ts` - проверка типов данных
- `scripts/debug-excel-values.ts` - отладка serial dates

---

## Changelog

См. файлы в `docs/`:
- `CHANGELOG-streaming.md` - изменения потоковой обработки
- `CHANGELOG-unified-import.md` - изменения унифицированного импорта

---

## Дополнительная документация

- `docs/unified-import-guide.md` - руководство по импорту
- `docs/dadata-connection-pooling.md` - настройка DaData
- `docs/custom-mapping-guide.md` - кастомный маппинг полей
- `docs/bulk-import.md` - импорт больших файлов
