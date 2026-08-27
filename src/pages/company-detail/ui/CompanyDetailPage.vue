<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface CompanyDetail {
  inn: string
  companyName: string | null
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
  lastDaDataUpdate: string | null
  firstWebinarId: number | null
  firstWebinar: string | null
  avgRetention: number
  interestedProducts: string[]
}

interface CompanyWebinar {
  webinarId: number
  webinarName: string
  webinarDate: string
  tags: string
  utmCampaign: string | null
  utmMedium: string | null
  attended: number
}

interface CompanyParticipant {
  email: string
  firstName: string | null
  lastName: string | null
  position: string | null
}

interface CompanySurveyAnswer {
  webinarId: number
  webinarName: string
  webinarDate: string
  participantEmail: string
  firstName: string | null
  lastName: string | null
  question: string
  answer: string
}

const company = ref<CompanyDetail | null>(null)
const webinars = ref<CompanyWebinar[]>([])
const allWebinars = ref<CompanyWebinar[]>([])
const participants = ref<CompanyParticipant[]>([])
const allParticipants = ref<CompanyParticipant[]>([])
const surveyAnswers = ref<CompanySurveyAnswer[]>([])
const webinarSearchQuery = ref('')
const participantSearchQuery = ref('')
const isLoading = ref(false)
const isSurveyAnswersExpanded = ref(true)
const isEnrichingFromDaData = ref(false)

const fetchCompanyDetail = async () => {
  try {
    const inn = decodeURIComponent(route.params.inn as string)
    const response = await fetch(`http://localhost:3000/api/companies/${encodeURIComponent(inn)}`)
    company.value = await response.json()
  } catch (error) {
    console.error('Error fetching company detail:', error)
  }
}

const fetchCompanyWebinars = async () => {
  try {
    const inn = decodeURIComponent(route.params.inn as string)
    const response = await fetch(`http://localhost:3000/api/companies/${encodeURIComponent(inn)}/webinars`)
    const data = await response.json()
    allWebinars.value = data.map((w: CompanyWebinar) => ({
      ...w,
      tags: w.tags ? w.tags.split(',').map(t => t.trim()).join(', ') : null
    }))
    applyWebinarFilters()
  } catch (error) {
    console.error('Error fetching company webinars:', error)
  }
}

const fetchCompanyParticipants = async () => {
  try {
    const inn = decodeURIComponent(route.params.inn as string)
    const response = await fetch(`http://localhost:3000/api/companies/${encodeURIComponent(inn)}/participants`)
    const data = await response.json()
    allParticipants.value = data
    applyParticipantFilters()
  } catch (error) {
    console.error('Error fetching company participants:', error)
  }
}

const fetchCompanySurveyAnswers = async () => {
  try {
    const inn = decodeURIComponent(route.params.inn as string)
    const response = await fetch(`http://localhost:3000/api/companies/${encodeURIComponent(inn)}/survey-answers`)
    surveyAnswers.value = await response.json()
  } catch (error) {
    console.error('Error fetching company survey answers:', error)
  }
}

const applyWebinarFilters = () => {
  let filtered = [...allWebinars.value]
  
  if (webinarSearchQuery.value.trim()) {
    const query = webinarSearchQuery.value.toLowerCase()
    filtered = filtered.filter(w => 
      w.webinarName.toLowerCase().includes(query) ||
      (w.tags && w.tags.toLowerCase().includes(query))
    )
  }
  
  webinars.value = filtered
}

const applyParticipantFilters = () => {
  let filtered = [...allParticipants.value]
  
  if (participantSearchQuery.value.trim()) {
    const query = participantSearchQuery.value.toLowerCase()
    filtered = filtered.filter(p => 
      p.email.toLowerCase().includes(query) ||
      (p.firstName && p.firstName.toLowerCase().includes(query)) ||
      (p.lastName && p.lastName.toLowerCase().includes(query)) ||
      (p.position && p.position.toLowerCase().includes(query))
    )
  }
  
  participants.value = filtered
}

const clearWebinarFilters = () => {
  webinarSearchQuery.value = ''
  applyWebinarFilters()
}

const clearParticipantFilters = () => {
  participantSearchQuery.value = ''
  applyParticipantFilters()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
}

const getParticipantName = (participant: CompanyParticipant) => {
  const firstName = participant.firstName?.trim()
  const lastName = participant.lastName?.trim()
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`
  } else if (firstName) {
    return firstName
  } else if (lastName) {
    return lastName
  } else {
    return '—'
  }
}

const getParticipantNameFromAnswer = (answer: CompanySurveyAnswer) => {
  const firstName = answer.firstName?.trim()
  const lastName = answer.lastName?.trim()
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`
  } else if (firstName) {
    return firstName
  } else if (lastName) {
    return lastName
  } else {
    return 'Участник'
  }
}

const loadData = async () => {
  isLoading.value = true
  await Promise.all([
    fetchCompanyDetail(),
    fetchCompanyWebinars(),
    fetchCompanyParticipants(),
    fetchCompanySurveyAnswers()
  ])
  isLoading.value = false
}

const enrichFromDaData = async () => {
  if (!company.value) return
  
  isEnrichingFromDaData.value = true
  try {
    const inn = company.value.inn
    const response = await fetch(`http://localhost:3000/api/enrich-company/${encodeURIComponent(inn)}`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Ошибка при обогащении данных')
    }
    
    const result = await response.json()
    
    if (result.success) {
      // Перезагружаем данные компании
      await fetchCompanyDetail()
      alert('Данные компании успешно обновлены из DaData')
    }
  } catch (error) {
    console.error('Error enriching company data:', error)
    alert('Ошибка при обновлении данных из DaData')
  } finally {
    isEnrichingFromDaData.value = false
  }
}

const formatNumber = (num: number | null) => {
  if (num === null || num === undefined) return '—'
  return new Intl.NumberFormat('ru-RU').format(num)
}

const formatLastUpdate = (dateStr: string | null) => {
  if (!dateStr) return 'Никогда'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <router-link to="/" class="text-2xl font-semibold text-gray-900 hover:text-gray-700 cursor-pointer">
          Дашборд по вебинарам
        </router-link>
        <router-link 
          to="/import"
          class="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition"
        >
          Управление данными
        </router-link>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <!-- Хлебные крошки -->
      <div class="mb-6">
        <nav class="flex items-center gap-2 text-sm text-gray-600">
          <router-link to="/" class="hover:text-gray-900">Главная</router-link>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span v-if="company" class="text-gray-900">{{ company.companyName || 'Компания' }} | ИНН: {{ company.inn }}</span>
        </nav>
      </div>

      <!-- Заголовок -->
      <div v-if="company" class="mb-6 flex items-center gap-3">
        <h2 class="text-xl font-semibold text-gray-900">{{ company.companyName || 'Компания' }} | ИНН: {{ company.inn }}</h2>
        <span v-if="company.isNew === true" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
          Новая
        </span>
        <span v-else-if="company.isNew === false" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
          Старая
        </span>
      </div>

      <div v-if="isLoading" class="text-center py-12">
        <div class="text-gray-500">Загрузка данных...</div>
      </div>

      <div v-else-if="company">
        <!-- Карточки с информацией -->
        <section class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Первый вебинар -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Первый вебинар</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Первый вебинар, который посетили участники компании (или зарегистрировались, если не было посещений)
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-lg text-gray-900">
                <router-link 
                  v-if="company.firstWebinarId && company.firstWebinar"
                  :to="`/webinar/${company.firstWebinarId}`"
                  class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  {{ company.firstWebinar }}
                </router-link>
                <span v-else>—</span>
              </div>
            </div>

            <!-- Среднее удержание -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Среднее удержание</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Средний процент присутствия участников компании на вебинарах
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-lg text-gray-900">{{ company.avgRetention }}%</div>
            </div>

            <!-- Интересующие продукты -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Интересующие продукты</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Топ-3 продукта по количеству посещений вебинаров компанией
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-lg text-gray-900">{{ company.interestedProducts.join(', ') || '—' }}</div>
            </div>
          </div>
        </section>

        <!-- Информация о компании из DaData -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Информация о компании</h2>
                
                <button
                  @click="enrichFromDaData"
                  :disabled="isEnrichingFromDaData"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg v-if="isEnrichingFromDaData" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ isEnrichingFromDaData ? 'Обновление...' : 'Обновить из DaData' }}
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <!-- Основная информация -->
                <div class="space-y-3">
                  <div>
                    <span class="font-medium text-gray-600">ИНН:</span>
                    <span class="ml-2 text-gray-900">{{ company.inn }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">КПП:</span>
                    <span class="ml-2 text-gray-900">{{ company.kpp || '—' }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">ОГРН:</span>
                    <span class="ml-2 text-gray-900">{{ company.ogrn || '—' }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">ОПФ:</span>
                    <span class="ml-2 text-gray-900">{{ company.opf || '—' }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">Тип:</span>
                    <span class="ml-2 text-gray-900">{{ company.organizationType || '—' }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">Головная/Филиал:</span>
                    <span class="ml-2 text-gray-900">{{ company.branchType || '—' }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">Статус:</span>
                    <span 
                      class="ml-2 px-2 py-1 rounded text-xs"
                      :class="{
                        'bg-green-100 text-green-800': company.status === 'Действующая',
                        'bg-yellow-100 text-yellow-800': company.status === 'Ликвидируется' || company.status === 'В процессе присоединения к другому юрлицу',
                        'bg-red-100 text-red-800': company.status === 'Ликвидирована' || company.status === 'Банкротство',
                        'bg-gray-100 text-gray-800': !company.status
                      }"
                    >
                      {{ company.status || '—' }}
                    </span>
                  </div>
                </div>

                <!-- Финансовая информация -->
                <div class="space-y-3">
                  <div>
                    <span class="font-medium text-gray-600">Система налогообложения:</span>
                    <span class="ml-2 text-gray-900">{{ company.taxSystem || '—' }}</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">Доходы:</span>
                    <span class="ml-2 text-gray-900">{{ formatNumber(company.income) }} ₽</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">Расходы:</span>
                    <span class="ml-2 text-gray-900">{{ formatNumber(company.expense) }} ₽</span>
                  </div>
                  
                  <div>
                    <span class="font-medium text-gray-600">Основной ОКВЭД:</span>
                    <span class="ml-2 text-gray-900">{{ company.mainOkved || '—' }}</span>
                  </div>
                  
                  <div v-if="company.additionalOkveds" class="col-span-2">
                    <span class="font-medium text-gray-600">Дополнительные ОКВЭД:</span>
                    <div class="ml-2 text-gray-900 text-xs mt-1 max-h-32 overflow-y-auto">
                      {{ company.additionalOkveds }}
                    </div>
                  </div>
                  
                  <div class="text-xs text-gray-500 pt-2">
                    Последнее обновление: {{ formatLastUpdate(company.lastDaDataUpdate) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Список вебинаров -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Список вебинаров</h2>
                
                <div class="flex items-center gap-4">
                  <button
                    @click="clearWebinarFilters"
                    v-if="webinarSearchQuery"
                    class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Filter
                  </button>

                  <div class="relative">
                    <input
                      v-model="webinarSearchQuery"
                      @input="applyWebinarFilters"
                      type="text"
                      placeholder="Поиск"
                      class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                    />
                    <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Таблица вебинаров -->
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Название
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Посетил
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        utm_campaign
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        utm_medium
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Теги
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="webinars.length === 0 && webinarSearchQuery">
                      <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет вебинаров, соответствующих поиску
                      </td>
                    </tr>
                    <tr v-else-if="webinars.length === 0">
                      <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет вебинаров
                      </td>
                    </tr>
                    <tr v-else v-for="webinar in webinars" :key="webinar.webinarId" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          :to="`/webinar/${webinar.webinarId}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ webinar.webinarName }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.attended === 1 ? 'Да' : 'Нет' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.utmCampaign || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.utmMedium || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.tags || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ formatDate(webinar.webinarDate) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Участники компании -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Участники компании</h2>
                
                <div class="flex items-center gap-4">
                  <button
                    @click="clearParticipantFilters"
                    v-if="participantSearchQuery"
                    class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Filter
                  </button>

                  <div class="relative">
                    <input
                      v-model="participantSearchQuery"
                      @input="applyParticipantFilters"
                      type="text"
                      placeholder="Поиск"
                      class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                    />
                    <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Таблица участников -->
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Email
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Имя
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Фамилия
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Должность
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="participants.length === 0 && participantSearchQuery">
                      <td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет участников, соответствующих поиску
                      </td>
                    </tr>
                    <tr v-else-if="participants.length === 0">
                      <td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет участников
                      </td>
                    </tr>
                    <tr v-else v-for="participant in participants" :key="participant.email" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          :to="`/participant/${encodeURIComponent(participant.email)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ participant.email }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ participant.firstName || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ participant.lastName || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ participant.position || '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Ответы на опросы -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-semibold text-gray-900">
                  Ответы на опросы
                  <span class="ml-2 text-sm font-normal text-gray-500">({{ surveyAnswers.length }})</span>
                </h2>
                <button
                  @click="isSurveyAnswersExpanded = !isSurveyAnswersExpanded"
                  class="text-gray-500 hover:text-gray-700"
                >
                  <svg 
                    class="w-6 h-6 transition-transform"
                    :class="{ 'rotate-180': !isSurveyAnswersExpanded }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              <div v-show="isSurveyAnswersExpanded" class="overflow-x-auto max-h-96 overflow-y-auto">
                <table class="min-w-full">
                  <thead class="sticky top-0 bg-white">
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Вебинар
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Участник
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Вопрос
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Ответ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="surveyAnswers.length === 0">
                      <td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет ответов на опросы
                      </td>
                    </tr>
                    <tr v-else v-for="(answer, index) in surveyAnswers" :key="index" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          :to="`/webinar/${answer.webinarId}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ answer.webinarName }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          :to="`/participant/${encodeURIComponent(answer.participantEmail)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ getParticipantNameFromAnswer(answer) }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {{ answer.question }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ answer.answer }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="text-center py-12">
        <div class="text-gray-500">Компания не найдена</div>
      </div>
    </main>
  </div>
</template>
