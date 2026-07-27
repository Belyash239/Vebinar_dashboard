<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface CompanyDetail {
  inn: string
  companyName: string | null
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
}

interface CompanyParticipant {
  email: string
  firstName: string | null
  lastName: string | null
  position: string | null
}

const company = ref<CompanyDetail | null>(null)
const webinars = ref<CompanyWebinar[]>([])
const allWebinars = ref<CompanyWebinar[]>([])
const participants = ref<CompanyParticipant[]>([])
const allParticipants = ref<CompanyParticipant[]>([])
const webinarSearchQuery = ref('')
const participantSearchQuery = ref('')
const isLoading = ref(false)

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

const loadData = async () => {
  isLoading.value = true
  await Promise.all([
    fetchCompanyDetail(),
    fetchCompanyWebinars(),
    fetchCompanyParticipants()
  ])
  isLoading.value = false
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 class="text-2xl font-semibold text-gray-900">Дашборд по вебинарам</h1>
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
        <span v-if="company.isNew" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
          Новая
        </span>
        <span v-else class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
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
              <div class="text-sm text-gray-600 mb-2">Первый вебинар</div>
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
              <div class="text-sm text-gray-600 mb-2">Среднее удержание</div>
              <div class="text-lg text-gray-900">{{ company.avgRetention }}%</div>
            </div>

            <!-- Интересующие продукты -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Интересующие продукты</div>
              <div class="text-lg text-gray-900">{{ company.interestedProducts.join(', ') || '—' }}</div>
            </div>
          </div>
        </section>

        <!-- Список посещенных вебинаров -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Список посещённых вебинаров</h2>
                
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
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет вебинаров, соответствующих поиску
                      </td>
                    </tr>
                    <tr v-else-if="webinars.length === 0">
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет посещенных вебинаров
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
        <section>
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
      </div>

      <div v-else class="text-center py-12">
        <div class="text-gray-500">Компания не найдена</div>
      </div>
    </main>
  </div>
</template>
