import fetch from 'node-fetch'
import * as dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config()

const DADATA_API_KEY = process.env.DADATA_API_KEY || ''
const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party'

if (!DADATA_API_KEY) {
  console.warn('⚠️ DADATA_API_KEY не найден в .env файле. Обогащение данных компаний будет недоступно.')
}

interface DaDataCompanyResponse {
  suggestions: Array<{
    value: string
    unrestricted_value: string
    data: {
      kpp: string | null
      ogrn: string
      okved: string
      okveds: Array<{
        main: boolean
        code: string
        name: string
      }> | null
      branch_type: 'MAIN' | 'BRANCH'
      type: 'LEGAL' | 'INDIVIDUAL'
      opf: {
        code: string
        full: string
        short: string
      }
      name: {
        full_with_opf: string
        short_with_opf: string
      }
      state: {
        status: 'ACTIVE' | 'LIQUIDATING' | 'LIQUIDATED' | 'BANKRUPT' | 'REORGANIZING'
      }
      finance: {
        tax_system: 'AUSN' | 'ESHN' | 'SRP' | 'USN' | null
        income: number | null
        expense: number | null
      } | null
    }
  }>
}

interface CompanyData {
  inn: string
  name: string
  kpp: string | null
  ogrn: string | null
  mainOkved: string | null
  additionalOkveds: string | null
  branchType: string | null
  organizationType: string | null
  opf: string | null
  taxSystem: string | null
  status: string | null
  income: number | null
  expense: number | null
}

class DaDataService {
  /**
   * Получает данные о компании по ИНН из DaData
   */
  async getCompanyByInn(inn: string): Promise<CompanyData | null> {
    if (!inn || inn.trim() === '') {
      console.log('⚠️ DaData: пустой ИНН')
      return null
    }

    try {
      console.log(`🔍 DaData: запрос данных для ИНН ${inn}`)

      const response = await fetch(DADATA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${DADATA_API_KEY}`
        },
        body: JSON.stringify({
          query: inn.trim(),
          count: 1,
          branch_type: 'MAIN' // Получаем только головную организацию по умолчанию
        })
      })

      if (!response.ok) {
        console.error(`❌ DaData: ошибка HTTP ${response.status}`)
        return null
      }

      const data = await response.json() as DaDataCompanyResponse

      if (!data.suggestions || data.suggestions.length === 0) {
        console.log(`⚠️ DaData: компания с ИНН ${inn} не найдена`)
        return null
      }

      const suggestion = data.suggestions[0]
      const companyData = suggestion.data

      // Преобразуем branch_type
      let branchType: string | null = null
      if (companyData.branch_type === 'MAIN') {
        branchType = 'Головная организация'
      } else if (companyData.branch_type === 'BRANCH') {
        branchType = 'Филиал'
      }

      // Преобразуем type
      let organizationType: string | null = null
      if (companyData.type === 'LEGAL') {
        organizationType = 'Юридическое лицо'
      } else if (companyData.type === 'INDIVIDUAL') {
        organizationType = 'Индивидуальный предприниматель'
      }

      // Преобразуем tax_system
      let taxSystem: string | null = null
      if (companyData.finance?.tax_system) {
        const taxSystemMap: { [key: string]: string } = {
          'AUSN': 'Автоматизированная УСН (АУСН)',
          'ESHN': 'Единый сельскохозяйственный налог (ЕСХН)',
          'SRP': 'Система налогообложения при выполнении соглашений о разделе продукции (СРП)',
          'USN': 'Упрощенная система налогообложения (УСН)'
        }
        taxSystem = taxSystemMap[companyData.finance.tax_system] || companyData.finance.tax_system
      }

      // Преобразуем status
      let status: string | null = null
      if (companyData.state?.status) {
        const statusMap: { [key: string]: string } = {
          'ACTIVE': 'Действующая',
          'LIQUIDATING': 'Ликвидируется',
          'LIQUIDATED': 'Ликвидирована',
          'BANKRUPT': 'Банкротство',
          'REORGANIZING': 'В процессе присоединения к другому юрлицу'
        }
        status = statusMap[companyData.state.status] || companyData.state.status
      }

      // Собираем дополнительные ОКВЭД
      let additionalOkveds: string | null = null
      if (companyData.okveds && companyData.okveds.length > 0) {
        additionalOkveds = companyData.okveds
          .map(okved => `${okved.code} - ${okved.name}`)
          .join('; ')
      }

      const result: CompanyData = {
        inn: inn.trim(),
        name: companyData.name.short_with_opf || companyData.name.full_with_opf,
        kpp: companyData.kpp || null,
        ogrn: companyData.ogrn || null,
        mainOkved: companyData.okved || null,
        additionalOkveds,
        branchType,
        organizationType,
        opf: companyData.opf?.short || companyData.opf?.full || null,
        taxSystem,
        status,
        income: companyData.finance?.income || null,
        expense: companyData.finance?.expense || null
      }

      console.log(`✅ DaData: получены данные для ${result.name} (${inn})`)
      return result
    } catch (error) {
      console.error(`❌ DaData: ошибка при запросе данных для ИНН ${inn}:`, error)
      return null
    }
  }

  /**
   * Получает данные о компаниях по массиву ИНН (с ограничением частоты запросов)
   */
  async getCompaniesByInnBatch(inns: string[]): Promise<Map<string, CompanyData>> {
    const results = new Map<string, CompanyData>()
    
    console.log(`📦 DaData: пакетный запрос для ${inns.length} ИНН`)

    for (const inn of inns) {
      const data = await this.getCompanyByInn(inn)
      if (data) {
        results.set(inn, data)
      }
      
      // Задержка между запросами (ограничение DaData - 20 запросов/сек)
      await new Promise(resolve => setTimeout(resolve, 60))
    }

    console.log(`✅ DaData: получены данные для ${results.size} из ${inns.length} компаний`)
    return results
  }
}

export const dadataService = new DaDataService()
