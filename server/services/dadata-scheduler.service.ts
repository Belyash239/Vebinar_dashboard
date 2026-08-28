import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import databaseService from '../database/database.service.js'
import { dadataService } from './dadata.service.js'
import * as dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface DaDataConfig {
  enabled: boolean
  intervalHours: number
  batchSize: number
  prioritizeLatestWebinar: boolean
  dailyLimit: number
}

interface EnrichmentState {
  lastRun: string | null
  todayCount: number
  lastResetDate: string
}

class DaDataSchedulerService {
  private config: DaDataConfig
  private state: EnrichmentState
  private timerId: NodeJS.Timeout | null = null
  private STATE_PATH = join(__dirname, '../config/dadata-state.json')
  private RUNTIME_CONFIG_PATH = join(__dirname, '../config/dadata-runtime-config.json')

  constructor() {
    // Создаём папку config если её нет
    const configDir = join(__dirname, '../config')
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
      console.log('📁 Создана папка server/config')
    }
    
    this.config = this.loadConfig()
    this.state = this.loadState()
  }

  private loadConfig(): DaDataConfig {
    // 1. Читаем базовую конфигурацию из .env
    const baseConfig: DaDataConfig = {
      enabled: process.env.DADATA_ENABLED === 'true',
      intervalHours: parseInt(process.env.DADATA_INTERVAL_HOURS || '12', 10),
      batchSize: parseInt(process.env.DADATA_BATCH_SIZE || '200', 10),
      prioritizeLatestWebinar: process.env.DADATA_PRIORITIZE_LATEST_WEBINAR !== 'false',
      dailyLimit: parseInt(process.env.DADATA_DAILY_LIMIT || '1000', 10)
    }

    // 2. Перезаписываем runtime настройками из UI (если есть)
    try {
      const runtimeData = readFileSync(this.RUNTIME_CONFIG_PATH, 'utf-8')
      const runtimeConfig = JSON.parse(runtimeData) as Partial<DaDataConfig>
      
      console.log('📋 DaData: найдены runtime настройки из UI')
      Object.assign(baseConfig, runtimeConfig)
    } catch (error) {
      // Файл не существует - это нормально при первом запуске
    }

    console.log('📋 DaData конфигурация загружена:')
    console.log(`   Включено: ${baseConfig.enabled}`)
    console.log(`   Интервал: каждые ${baseConfig.intervalHours} часов`)
    console.log(`   Размер batch: ${baseConfig.batchSize}`)
    console.log(`   Приоритет последнему вебинару: ${baseConfig.prioritizeLatestWebinar}`)
    console.log(`   Дневной лимит: ${baseConfig.dailyLimit}`)

    return baseConfig
  }

  private loadState(): EnrichmentState {
    try {
      const data = readFileSync(this.STATE_PATH, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      return {
        lastRun: null,
        todayCount: 0,
        lastResetDate: new Date().toISOString().split('T')[0]
      }
    }
  }

  private saveState() {
    try {
      writeFileSync(this.STATE_PATH, JSON.stringify(this.state, null, 2))
    } catch (error) {
      console.error('❌ Ошибка сохранения состояния DaData:', error)
    }
  }

  getConfig(): DaDataConfig {
    return { ...this.config }
  }

  getState(): EnrichmentState {
    return { ...this.state }
  }

  updateConfig(newConfig: Partial<DaDataConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    // Сохраняем runtime конфигурацию в JSON файл
    try {
      writeFileSync(this.RUNTIME_CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8')
      console.log('✅ Конфигурация DaData обновлена и сохранена')
      console.log('💡 Runtime настройки сохранены в:', this.RUNTIME_CONFIG_PATH)
    } catch (error) {
      console.error('❌ Ошибка сохранения runtime конфигурации:', error)
    }
    
    // Перезапускаем планировщик с новыми настройками
    if (this.config.enabled) {
      this.stop()
      this.start()
    } else {
      this.stop()
    }
  }

  private resetDailyCountIfNeeded() {
    // Получаем текущую дату по московскому времени (UTC+3)
    const moscowDate = new Date(new Date().getTime() + 3 * 60 * 60 * 1000)
    const today = moscowDate.toISOString().split('T')[0]
    
    if (this.state.lastResetDate !== today) {
      console.log(`📅 Сброс дневного счётчика DaData: ${this.state.lastResetDate} → ${today}`)
      this.state.todayCount = 0
      this.state.lastResetDate = today
      this.saveState()
    }
  }

  private getCompaniesToEnrich(): string[] {
    const { batchSize, prioritizeLatestWebinar, dailyLimit } = this.config
    
    this.resetDailyCountIfNeeded()
    
    const remainingQuota = dailyLimit - this.state.todayCount
    if (remainingQuota <= 0) {
      console.log('⚠️ Достигнут дневной лимит запросов к DaData')
      return []
    }
    
    const actualBatchSize = Math.min(batchSize, remainingQuota)
    
    if (prioritizeLatestWebinar) {
      // Получаем компании из последнего вебинара
      const latestWebinarCompanies = databaseService.execQueryForExport(`
        SELECT DISTINCT c.ИНН_компании as inn
        FROM Компания c
        INNER JOIN Участники u ON c.ID_компании = u.ID_компании
        INNER JOIN "Участники-Вебинары" uw ON u.ID_участника = uw.ID_участника
        INNER JOIN Вебинары w ON uw.ID_вебинара = w.ID_вебинара
        WHERE w.ID_вебинара = (SELECT ID_вебинара FROM Вебинары ORDER BY Дата DESC LIMIT 1)
          AND (c.Дата_обновления_DaData IS NULL OR datetime(c.Дата_обновления_DaData) < datetime('now', '-30 days'))
        LIMIT ?
      `, [actualBatchSize]) as Array<{ inn: string }>
      
      const latestWebinarInns = latestWebinarCompanies.map(r => r.inn)
      
      // Если не хватает, добираем из остальных
      if (latestWebinarInns.length < actualBatchSize) {
        const remaining = actualBatchSize - latestWebinarInns.length
        const otherCompanies = databaseService.getCompaniesNeedingDaDataUpdate(remaining)
          .filter(inn => !latestWebinarInns.includes(inn))
        
        return [...latestWebinarInns, ...otherCompanies]
      }
      
      return latestWebinarInns
    } else {
      return databaseService.getCompaniesNeedingDaDataUpdate(actualBatchSize)
    }
  }

  async enrichCompanies() {
    if (!this.config.enabled) {
      console.log('⏸️ Автообогащение DaData отключено')
      return { success: false, message: 'Disabled' }
    }

    const innsToEnrich = this.getCompaniesToEnrich()
    
    if (innsToEnrich.length === 0) {
      console.log('ℹ️ Нет компаний для обогащения')
      return { success: true, updated: 0, total: 0 }
    }

    console.log(`🔄 Начало автообогащения: ${innsToEnrich.length} компаний`)
    
    let updatedCount = 0
    let deletedCount = 0

    for (const inn of innsToEnrich) {
      // Игнорируем конкретные ИНН (игнор-лист)
      const ignoredInns = ['4027145240', '4029017981']
      if (ignoredInns.includes(inn)) {
        console.log(`⏭️ Пропуск ИНН ${inn} (в игнор-листе)`)
        continue
      }

      try {
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
        } else {
          // Компания не найдена в DaData - удаляем её
          console.log(`🗑️ Удаление компании с ИНН ${inn} (не найдена в DaData)`)
          databaseService.deleteCompanyByInn(inn)
          deletedCount++
        }

        // Задержка между запросами для соблюдения rate limit (20 запросов/сек)
        await new Promise(resolve => setTimeout(resolve, 65))
      } catch (error) {
        console.error(`❌ Ошибка обогащения ${inn}:`, error)
      }
    }

    databaseService.saveDatabase()

    this.state.lastRun = new Date().toISOString()
    this.state.todayCount += updatedCount
    this.saveState()

    console.log(`✅ Автообогащение завершено: обновлено ${updatedCount}, удалено ${deletedCount}`)
    
    return { 
      success: true, 
      updated: updatedCount,
      deleted: deletedCount,
      total: innsToEnrich.length,
      todayCount: this.state.todayCount,
      dailyLimit: this.config.dailyLimit
    }
  }

  start() {
    if (!this.config.enabled) {
      console.log('⏸️ Планировщик DaData отключен в конфигурации')
      return
    }

    if (this.timerId) {
      console.log('⚠️ Планировщик DaData уже запущен')
      return
    }

    const intervalMs = this.config.intervalHours * 60 * 60 * 1000

    console.log(`🚀 Запуск планировщика DaData (интервал: ${this.config.intervalHours}ч, размер батча: ${this.config.batchSize})`)

    // Запускаем сразу
    this.enrichCompanies()

    // Планируем последующие запуски
    this.timerId = setInterval(() => {
      this.enrichCompanies()
    }, intervalMs)
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
      console.log('⏹️ Планировщик DaData остановлен')
    }
  }

  async forceRun() {
    console.log('⚡ Принудительный запуск обогащения DaData')
    return await this.enrichCompanies()
  }
}

export const dadataScheduler = new DaDataSchedulerService()
