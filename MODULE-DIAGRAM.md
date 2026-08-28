# Диаграмма связей модулей

## Общая архитектура

```
┌────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vue 3)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   HomePage   │  │  Dashboard   │  │ CompanyDetail│         │
│  │  (графики)   │  │  (компании)  │  │   (детали)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ ImportModal  │  │BulkImport    │  │DaDataSettings│         │
│  │ (основной)   │  │(большие файлы│  │  (настройки) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────────────────────────────────────────┘
                            ↓ REST API (HTTP)
┌────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    server/index.ts                        │  │
│  │              (API endpoints, routing)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Parser Service│→ │Database Svc  │ ←│Export Service│         │
│  │(Excel парсинг│  │(SQLite CRUD) │  │(Excel экспорт│         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         ↓                  ↑                                    │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │Field Mappings│  │DaData Service│                            │
│  │(автомаппинг) │  │(API клиент)  │                            │
│  └──────────────┘  └──────────────┘                            │
│                            ↑                                    │
│                    ┌──────────────┐                             │
│                    │DaData        │                             │
│                    │Scheduler     │                             │
│                    │(планировщик) │                             │
│                    └──────────────┘                             │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                     DATABASE (SQLite)                           │
│                       webinars.db                               │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                   EXTERNAL API (DaData)                         │
└────────────────────────────────────────────────────────────────┘
```

## Детальные связи сервисов

### Parser Service → Database Service

```
ParserService
  ├─ parseMainFile()
  │   ├─→ getOrCreateWebinar()
  │   ├─→ getOrCreateParticipantByEmail()
  │   ├─→ getOrCreateCompany()
  │   └─→ addParticipantWebinar()
  │
  ├─ parseBulkFileStreaming()
  │   ├─→ getOrCreateWebinar()
  │   ├─→ getOrCreateParticipantByEmail()
  │   ├─→ getOrCreateCompany()
  │   └─→ addParticipantWebinar()
  │
  └─ parseSurveyFile()
      ├─→ getNextSurveyId()
      └─→ addSurveyQuestion()
```

### DaData Scheduler → DaData Service → Database Service

```
DaDataScheduler
  ├─ start() (every 12h)
  │   └─→ enrichCompanies()
  │       ├─→ getCompaniesToEnrich()  [DatabaseService]
  │       │   └─ SELECT companies WHERE dadata IS NULL
  │       │
  │       ├─→ getCompaniesByInnBatch() [DaDataService]
  │       │   └─→ getCompanyByInn() × N
  │       │       └─ fetch(DADATA_API)
  │       │
  │       └─→ updateCompanyFromDaData() [DatabaseService]
  │           └─ UPDATE companies SET dadata_fields
  │
  └─ enrichNow() (manual trigger)
      └─→ [same as auto]
```

### Export Service → Database Service

```
ExportService
  └─ exportToExcel(filters)
      └─→ DatabaseService.query()
          ├─ JOIN участники
          ├─ JOIN компании
          ├─ JOIN вебинары
          └─ WHERE filters
          └─→ ExcelJS.write()
```

### Field Mappings (утилита)

```
autoMapColumns(excelColumns)
  ├─ normalize(column)
  ├─ exactMatch()
  ├─ fuzzyMatch()
  └─→ return { excelColumn → dbField }

Used by:
  ├─ BulkImportModal (frontend)
  └─ parseBulkFile() (backend)
```

## Потоки данных

### 1. Импорт участников (основной файл)

```
[User] → [ImportModal]
   ↓ POST /api/upload (file, sheetType, format)
[Express Handler]
   ↓ multer.single('file')
[ParserService.parseMainFile()]
   ↓ XLSX.readFile()
   ↓ Validate data
   ↓
[DatabaseService]
   ├─ BEGIN TRANSACTION
   ├─ getOrCreateWebinar()      → INSERT Вебинары
   ├─ getOrCreateCompany()       → INSERT Компании (if ИНН valid)
   ├─ getOrCreateParticipantByEmail() → INSERT Участники + Email
   ├─ addParticipantWebinar()    → INSERT Участники-Вебинары
   └─ COMMIT
   ↓
[Response] { success, webinarId, stats }
```

### 2. Импорт большого файла

```
[User] → [BulkImportModal]
   ↓ POST /api/upload-bulk (file, mappings)
[Express Handler]
   ↓ multer.single('file')
[ParserService.parseBulkFileStreaming()]
   ↓ ExcelJS.stream.xlsx.WorkbookReader()
   ↓ for each row (streaming)
      ↓ map columns using mappings
      ↓ validate data
      ↓
   [DatabaseService] (batch every 1000 rows)
      ├─ BEGIN TRANSACTION
      ├─ getOrCreateWebinar() × N
      ├─ getOrCreateCompany() × N
      ├─ getOrCreateParticipantByEmail() × N
      ├─ addParticipantWebinar() × N
      └─ COMMIT
      ↓ saveDatabase() (checkpoint)
   ↓
[Response] { success, stats }
```

### 3. Автообогащение DaData

```
[Timer] (every 12 hours)
   ↓
[DaDataScheduler.enrichCompanies()]
   ↓
[DatabaseService.getCompaniesToEnrich()]
   ↓ SELECT ИНН WHERE dadata IS NULL OR old
   ↓ prioritize latest webinar
   ↓ LIMIT batchSize
   ↓
[DaDataService.getCompaniesByInnBatch()]
   ↓ for each ИНН
      ↓ fetch(DADATA_API, inn)
      ↓ await 50ms (rate limiting)
   ↓ return Map<ИНН, CompanyData>
   ↓
[DatabaseService.updateCompanyFromDaData()]
   ↓ UPDATE Компании SET
      ├─ КПП, ОГРН
      ├─ ОКВЭД
      ├─ ОПФ, Тип_организации
      ├─ Система_налогообложения
      ├─ Статус
      ├─ Доходы, Расходы
      └─ Дата_обновления_DaData
   ↓
[State.todayCount++]
[State.save()]
```

### 4. Экспорт в Excel

```
[User] → GET /api/export?filters
   ↓
[ExportService.exportToExcel(filters)]
   ↓
[DatabaseService.query()]
   ↓ SELECT * FROM Участники-Вебинары
   ↓ JOIN Участники
   ↓ JOIN Email
   ↓ JOIN Компании
   ↓ JOIN Вебинары
   ↓ WHERE filters
   ↓
[ExcelJS.write()]
   ├─ Create workbook
   ├─ Add worksheet
   ├─ Write headers
   ├─ Write rows (with formatting)
   └─ Return buffer
   ↓
[Response] Excel file download
```

## Взаимодействие с конфигурацией

### .env → Services

```
.env
  ├─ DADATA_API_KEY
  │   └─→ DaDataService (constructor)
  │
  └─ DADATA_*
      └─→ DaDataScheduler.loadConfig()
          ├─ DADATA_ENABLED → config.enabled
          ├─ DADATA_INTERVAL_HOURS → config.intervalHours
          ├─ DADATA_BATCH_SIZE → config.batchSize
          ├─ DADATA_PRIORITIZE_LATEST_WEBINAR → config.prioritizeLatestWebinar
          └─ DADATA_DAILY_LIMIT → config.dailyLimit
```

### State Management

```
dadata-state.json
  ├─ lastRun: ISO timestamp
  ├─ todayCount: number
  └─ lastResetDate: "YYYY-MM-DD"

Updated by:
  ├─ DaDataScheduler.enrichCompanies() → increment todayCount
  └─ DaDataScheduler.resetDailyCountIfNeeded() → reset at midnight MSK
```

## Зависимости модулей

```
server/index.ts
  ├─→ parser.service.ts
  ├─→ database.service.ts
  ├─→ export.service.ts
  └─→ dadata-scheduler.service.ts

parser.service.ts
  ├─→ database.service.ts
  └─→ field-mappings.ts

database.service.ts
  └─→ better-sqlite3

dadata-scheduler.service.ts
  ├─→ dadata.service.ts
  └─→ database.service.ts

dadata.service.ts
  └─→ node-fetch

export.service.ts
  ├─→ database.service.ts
  └─→ ExcelJS
```

## Основные интерфейсы

### Parser Service

```typescript
interface ParserService {
  // Основной импорт
  parseMainFile(path, webinarId?, format): Promise<{webinarName, webinarDate}>
  
  // Большие файлы
  parseBulkFile(path, mappings): Promise<void>
  parseBulkFileStreaming(path, mappings, progress?): Promise<void>
  
  // Опросы
  parseSurveyFile(path, webinarId?, importPositions?): Promise<void>
  
  // Утилиты
  readExcelColumns(path, fileType): Promise<{columns, rowCount}>
  detectFileTypeBySheets(path): Promise<FileType>
}
```

### Database Service

```typescript
interface DatabaseService {
  // Вебинары
  getOrCreateWebinar(name, date?): number
  getAllWebinars(): Webinar[]
  
  // Участники
  getOrCreateParticipantByEmail(email, ...): number | null
  addParticipantWebinar(participantId, webinarId, data): void
  
  // Компании
  getOrCreateCompany(inn, name?): number | null
  updateCompanyFromDaData(inn, data): void
  getAllCompanies(filters): Company[]
  
  // Опросы
  addSurveyQuestion(surveyId, question, webinarId?, emailId?, answer?): void
}
```

### DaData Service

```typescript
interface DaDataService {
  getCompanyByInn(inn): Promise<CompanyData | null>
  getCompaniesByInnBatch(inns): Promise<Map<string, CompanyData>>
}
```

### DaData Scheduler

```typescript
interface DaDataScheduler {
  start(): void
  stop(): void
  enrichNow(): Promise<EnrichmentResult>
  getConfig(): DaDataConfig
  updateConfig(partial): void
  getState(): EnrichmentState
}
```

## HTTP API Endpoints

```
POST   /api/upload              - Загрузка основного файла
POST   /api/upload-bulk         - Загрузка большого файла
POST   /api/upload-survey       - Загрузка опроса
GET    /api/webinars            - Список вебинаров
GET    /api/webinars/:id        - Детали вебинара
GET    /api/participants        - Список участников
GET    /api/companies           - Список компаний
GET    /api/companies/:inn      - Детали компании
GET    /api/surveys             - Список опросов
GET    /api/export              - Экспорт в Excel (с фильтрами)
GET    /api/dadata/config       - Конфигурация DaData
POST   /api/dadata/config       - Обновление конфигурации
GET    /api/dadata/state        - Состояние (счётчик)
POST   /api/dadata/enrich-now   - Запуск обогащения вручную
POST   /api/read-columns        - Чтение колонок для маппинга
```
