<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface WebinarDetail {
  id: number
  name: string
  date: string
  tags: string | null
  participantCount: number
  registeredCount: number
  avgRetention: number
  conversion: number
}

interface WebinarUser {
  inn: string
  chatName: string
  emails: string
  retention: number
  products: string
}

interface UtmStat {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  count: number
}

interface UtmTreeNode {
  value: string
  count: number
  percentage: number
  children?: UtmTreeNode[]
  expanded?: boolean
}

const webinar = ref<WebinarDetail | null>(null)
const users = ref<WebinarUser[]>([])
const allUsers = ref<WebinarUser[]>([])
const utmStats = ref<UtmStat[]>([])
const utmTree = ref<UtmTreeNode[]>([])
const searchQuery = ref('')
const isLoading = ref(false)

const fetchWebinarDetail = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/webinars/${route.params.id}`)
    webinar.value = await response.json()
  } catch (error) {
    console.error('Error fetching webinar detail:', error)
  }
}

const fetchWebinarUsers = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/webinars/${route.params.id}/users`)
    const data = await response.json()
    allUsers.value = data
    applyFilters()
  } catch (error) {
    console.error('Error fetching webinar users:', error)
  }
}

const fetchUtmStats = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/webinars/${route.params.id}/utm-stats`)
    utmStats.value = await response.json()
    buildUtmTree()
  } catch (error) {
    console.error('Error fetching UTM stats:', error)
  }
}

const buildUtmTree = () => {
  // Фильтруем записи, где все UTM метки пустые
  const filteredStats = utmStats.value.filter(stat => 
    stat.utm_source || stat.utm_medium || stat.utm_campaign || stat.utm_content
  )

  if (filteredStats.length === 0) {
    utmTree.value = []
    return
  }

  const totalCount = filteredStats.reduce((sum, stat) => sum + stat.count, 0)
  const tree: { [key: string]: any } = {}

  filteredStats.forEach(stat => {
    const source = stat.utm_source || '(не указан)'
    const medium = stat.utm_medium || '(не указан)'
    const campaign = stat.utm_campaign || '(не указан)'
    const content = stat.utm_content || '(не указан)'

    if (!tree[source]) {
      tree[source] = { count: 0, children: {} }
    }
    tree[source].count += stat.count

    if (!tree[source].children[medium]) {
      tree[source].children[medium] = { count: 0, children: {} }
    }
    tree[source].children[medium].count += stat.count

    if (!tree[source].children[medium].children[campaign]) {
      tree[source].children[medium].children[campaign] = { count: 0, children: {} }
    }
    tree[source].children[medium].children[campaign].count += stat.count

    if (!tree[source].children[medium].children[campaign].children[content]) {
      tree[source].children[medium].children[campaign].children[content] = { count: 0 }
    }
    tree[source].children[medium].children[campaign].children[content].count += stat.count
  })

  // Конвертируем в массив для отображения
  utmTree.value = Object.entries(tree).map(([source, sourceData]: [string, any]) => ({
    value: source,
    count: sourceData.count,
    percentage: totalCount > 0 ? (sourceData.count / totalCount) * 100 : 0,
    expanded: false,
    children: Object.entries(sourceData.children).map(([medium, mediumData]: [string, any]) => ({
      value: medium,
      count: mediumData.count,
      percentage: sourceData.count > 0 ? (mediumData.count / sourceData.count) * 100 : 0,
      expanded: false,
      children: Object.entries(mediumData.children).map(([campaign, campaignData]: [string, any]) => ({
        value: campaign,
        count: campaignData.count,
        percentage: mediumData.count > 0 ? (campaignData.count / mediumData.count) * 100 : 0,
        expanded: false,
        children: Object.entries(campaignData.children).map(([content, contentData]: [string, any]) => ({
          value: content,
          count: contentData.count,
          percentage: campaignData.count > 0 ? (contentData.count / campaignData.count) * 100 : 0
        }))
      }))
    }))
  })).sort((a, b) => b.count - a.count)
}

const toggleNode = (node: UtmTreeNode) => {
  node.expanded = !node.expanded
}

const applyFilters = () => {
  let filtered = [...allUsers.value]
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(u => 
      (u.inn && u.inn.toLowerCase().includes(query)) ||
      (u.chatName && u.chatName.toLowerCase().includes(query)) ||
      (u.emails && u.emails.toLowerCase().includes(query))
    )
  }
  
  users.value = filtered
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

const formatProducts = (products: string | null) => {
  if (!products) return '—'
  return products.split(',').map(p => p.trim()).filter(p => p).join(', ')
}

const loadData = async () => {
  isLoading.value = true
  await Promise.all([
    fetchWebinarDetail(),
    fetchWebinarUsers(),
    fetchUtmStats()
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
          <span v-if="webinar" class="text-gray-900">{{ webinar.name }}</span>
        </nav>
      </div>

      <!-- Название и дата вебинара -->
      <div v-if="webinar" class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900">{{ webinar.name }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ formatDate(webinar.date) }}</p>
      </div>

      <div v-if="isLoading" class="text-center py-12">
        <div class="text-gray-500">Загрузка данных...</div>
      </div>

      <div v-else-if="webinar">
        <!-- Карточки метрик -->
        <section class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <!-- Кол-во зарегистрированных -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Зарегистрировано</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Общее количество зарегистрированных на вебинар
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ webinar.registeredCount }}</div>
            </div>

            <!-- Кол-во участников -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Посетило</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Количество участников, которые присутствовали на вебинаре >= 1 минуты
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ webinar.participantCount }}</div>
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
                    Средний процент присутствия от общей длительности мероприятия
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ webinar.avgRetention }}%</div>
            </div>

            <!-- Конверсия -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Конверсия</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Конверсия из регистрации в посещение
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ webinar.conversion }}%</div>
            </div>
          </div>
        </section>

        <!-- Список пользователей -->
        <section>
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Список пользователей</h2>
                
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

              <!-- Таблица с прокруткой -->
              <div style="max-height: 600px; overflow-y: auto;">
                <table class="w-full table-fixed">
                  <colgroup>
                    <col style="width: 15%;">
                    <col style="width: 15%;">
                    <col style="width: 25%;">
                    <col style="width: 15%;">
                    <col style="width: 30%;">
                  </colgroup>
                  <thead class="sticky top-0 bg-white z-10">
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        ИНН
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Имя в чате
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Email
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Удержание
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Продукты
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="users.length === 0 && searchQuery">
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет пользователей, соответствующих поиску
                      </td>
                    </tr>
                    <tr v-else-if="users.length === 0">
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет пользователей
                      </td>
                    </tr>
                    <tr v-else v-for="user in users" :key="user.inn" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900 break-words overflow-hidden">
                        <router-link 
                          :to="`/company/${encodeURIComponent(user.inn)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ user.inn }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 break-words overflow-hidden">
                        {{ user.chatName || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 break-words overflow-hidden">
                        <div v-if="user.emails" class="flex flex-col gap-1">
                          <router-link 
                            v-for="(email, index) in formatEmails(user.emails)" 
                            :key="index"
                            :to="`/participant/${encodeURIComponent(email)}`"
                            class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {{ email }}
                          </router-link>
                        </div>
                        <span v-else>—</span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 break-words overflow-hidden">
                        {{ user.retention }}%
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 break-words overflow-hidden">
                        {{ formatProducts(user.products) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- UTM статистика -->
        <section class="mt-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center gap-2 mb-6">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <h2 class="text-xl font-semibold text-gray-900">UTM-статистика</h2>
              </div>

              <div v-if="utmTree.length === 0" class="text-center py-8 text-gray-500">
                Нет UTM данных
              </div>

              <div v-else class="space-y-1">
                <!-- utm_source (уровень 1) -->
                <div v-for="source in utmTree" :key="source.value" class="border-l-2 border-gray-200">
                  <div 
                    @click="toggleNode(source)"
                    class="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                  >
                    <div class="flex items-center gap-2">
                      <svg 
                        class="w-4 h-4 text-gray-400 transition-transform"
                        :class="{ 'rotate-90': source.expanded }"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <span class="text-sm font-medium text-gray-700">{{ source.value }}</span>
                      <span class="text-xs text-gray-400">utm_source</span>
                    </div>
                    <div class="flex items-center gap-4">
                      <span class="text-sm text-gray-600">{{ source.count }}</span>
                      <span class="text-sm text-gray-400 w-16 text-right">{{ source.percentage.toFixed(1) }}%</span>
                    </div>
                  </div>

                  <!-- utm_medium (уровень 2) -->
                  <div v-if="source.expanded && source.children" class="ml-6 border-l-2 border-gray-200">
                    <div v-for="medium in source.children" :key="medium.value">
                      <div 
                        @click="toggleNode(medium)"
                        class="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                      >
                        <div class="flex items-center gap-2">
                          <svg 
                            class="w-4 h-4 text-gray-400 transition-transform"
                            :class="{ 'rotate-90': medium.expanded }"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                          <span class="text-sm text-gray-600">{{ medium.value }}</span>
                          <span class="text-xs text-gray-400">utm_medium</span>
                        </div>
                        <div class="flex items-center gap-4">
                          <span class="text-sm text-gray-600">{{ medium.count }}</span>
                          <span class="text-sm text-gray-400 w-16 text-right">{{ medium.percentage.toFixed(1) }}%</span>
                        </div>
                      </div>

                      <!-- utm_campaign (уровень 3) -->
                      <div v-if="medium.expanded && medium.children" class="ml-6 border-l-2 border-gray-200">
                        <div v-for="campaign in medium.children" :key="campaign.value">
                          <div 
                            @click="toggleNode(campaign)"
                            class="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                          >
                            <div class="flex items-center gap-2">
                              <svg 
                                class="w-4 h-4 text-gray-400 transition-transform"
                                :class="{ 'rotate-90': campaign.expanded }"
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                              </svg>
                              <span class="text-sm text-gray-600">{{ campaign.value }}</span>
                              <span class="text-xs text-gray-400">utm_campaign</span>
                            </div>
                            <div class="flex items-center gap-4">
                              <span class="text-sm text-gray-600">{{ campaign.count }}</span>
                              <span class="text-sm text-gray-400 w-16 text-right">{{ campaign.percentage.toFixed(1) }}%</span>
                            </div>
                          </div>

                          <!-- utm_content (уровень 4) -->
                          <div v-if="campaign.expanded && campaign.children" class="ml-6 border-l-2 border-gray-100">
                            <div v-for="content in campaign.children" :key="content.value">
                              <div class="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                                <div class="flex items-center gap-2 ml-6">
                                  <span class="text-sm text-gray-500">{{ content.value }}</span>
                                  <span class="text-xs text-gray-400">utm_content</span>
                                </div>
                                <div class="flex items-center gap-4">
                                  <span class="text-sm text-gray-600">{{ content.count }}</span>
                                  <span class="text-sm text-gray-400 w-16 text-right">{{ content.percentage.toFixed(1) }}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
