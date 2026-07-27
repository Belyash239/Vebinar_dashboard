<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface ParticipantDetail {
  email: string
  inn: string | null
  companyName: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  position: string | null
  isNew: boolean
}

interface ParticipantWebinar {
  webinarId: number
  webinarName: string
  webinarDate: string
  tags: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
}

const participant = ref<ParticipantDetail | null>(null)
const webinars = ref<ParticipantWebinar[]>([])
const allWebinars = ref<ParticipantWebinar[]>([])
const searchQuery = ref('')
const isLoading = ref(false)

const fetchParticipantDetail = async () => {
  try {
    const email = decodeURIComponent(route.params.email as string)
    const response = await fetch(`http://localhost:3000/api/participants/${encodeURIComponent(email)}`)
    participant.value = await response.json()
  } catch (error) {
    console.error('Error fetching participant detail:', error)
  }
}

const fetchParticipantWebinars = async () => {
  try {
    const email = decodeURIComponent(route.params.email as string)
    const response = await fetch(`http://localhost:3000/api/participants/${encodeURIComponent(email)}/webinars`)
    const data = await response.json()
    // Форматируем теги с пробелами после запятых
    allWebinars.value = data.map((w: ParticipantWebinar) => ({
      ...w,
      tags: w.tags ? w.tags.split(',').map(t => t.trim()).join(', ') : null
    }))
    applyFilters()
  } catch (error) {
    console.error('Error fetching participant webinars:', error)
  }
}

const applyFilters = () => {
  let filtered = [...allWebinars.value]
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(w => 
      w.webinarName.toLowerCase().includes(query) ||
      (w.tags && w.tags.toLowerCase().includes(query))
    )
  }
  
  webinars.value = filtered
}

const clearFilters = () => {
  searchQuery.value = ''
  applyFilters()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
}

const formatEmails = (emails: string | null) => {
  if (!emails) return []
  return emails.split(',').map(e => e.trim()).filter(e => e)
}

const getParticipantName = () => {
  if (!participant.value) return 'Участник'
  
  const firstName = participant.value.firstName?.trim()
  const lastName = participant.value.lastName?.trim()
  
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
    fetchParticipantDetail(),
    fetchParticipantWebinars()
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
          <span v-if="participant" class="text-gray-900">
            {{ getParticipantName() }} | ИНН компании: 
            <router-link 
              v-if="participant.inn"
              :to="`/company/${encodeURIComponent(participant.inn)}`"
              class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {{ participant.inn }}
            </router-link>
            <span v-else>—</span>
          </span>
        </nav>
      </div>

      <!-- Заголовок -->
      <div v-if="participant" class="mb-6 flex items-center gap-3">
        <h2 class="text-xl font-semibold text-gray-900">
          {{ getParticipantName() }} | ИНН компании: 
          <router-link 
            v-if="participant.inn"
            :to="`/company/${encodeURIComponent(participant.inn)}`"
            class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            {{ participant.inn }}
          </router-link>
          <span v-else>—</span>
        </h2>
        <span v-if="participant.isNew" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
          Новый
        </span>
        <span v-else class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
          Старый
        </span>
      </div>

      <div v-if="isLoading" class="text-center py-12">
        <div class="text-gray-500">Загрузка данных...</div>
      </div>

      <div v-else-if="participant">
        <!-- Карточки с информацией -->
        <section class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Email -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Email</div>
              <div class="text-lg text-gray-900">{{ participant.email }}</div>
            </div>

            <!-- Компания -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Компания</div>
              <div class="text-lg text-gray-900">{{ participant.companyName || '—' }}</div>
            </div>

            <!-- Должность -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Должность</div>
              <div class="text-lg text-gray-900">{{ participant.position || '—' }}</div>
            </div>
          </div>
        </section>

        <!-- Список посещенных вебинаров -->
        <section>
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Список посещенных вебинаров</h2>
                
                <div class="flex items-center gap-4">
                  <button
                    @click="clearFilters"
                    v-if="searchQuery"
                    class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Filter
                  </button>

                  <div class="relative">
                    <input
                      v-model="searchQuery"
                      @input="applyFilters"
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

              <!-- Таблица -->
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Название
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        utm_source
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        utm_medium
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        utm_campaign
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        utm_content
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
                    <tr v-if="webinars.length === 0 && searchQuery">
                      <td colspan="7" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет вебинаров, соответствующих поиску
                      </td>
                    </tr>
                    <tr v-else-if="webinars.length === 0">
                      <td colspan="7" class="px-6 py-8 text-center text-sm text-gray-500">
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
                        {{ webinar.utmSource || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.utmMedium || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.utmCampaign || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.utmContent || '—' }}
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
      </div>
    </main>
  </div>
</template>
