<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

// Регистрируем компоненты Chart.js
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

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
  utm_term: string | null
  utm_custom: string | null
  count: number
}

interface UtmTreeNode {
  value: string
  count: number
  percentage: number
  children?: UtmTreeNode[]
  expanded?: boolean
}

interface SunburstNode {
  name: string
  value: number
  children?: SunburstNode[]
  level?: number
  color?: string
  parentColor?: string
}

const webinar = ref<WebinarDetail | null>(null)
const users = ref<WebinarUser[]>([])
const allUsers = ref<WebinarUser[]>([])
const utmStats = ref<UtmStat[]>([])
const utmTree = ref<UtmTreeNode[]>([])
const sunburstData = ref<SunburstNode | null>(null)
const searchQuery = ref('')
const isLoading = ref(false)
const sunburstContainer = ref<HTMLCanvasElement | null>(null)
const hoveredSegment = ref<{ name: string; value: number; percentage: number; x: number; y: number } | null>(null)
let chartInstance: Chart | null = null

// Состояние для отображения графика
const currentLevel = ref<'medium' | 'campaign' | 'content' | 'term' | 'custom'>('medium')

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
    stat.utm_source || stat.utm_medium || stat.utm_campaign || stat.utm_content || stat.utm_term || stat.utm_custom
  )

  if (filteredStats.length === 0) {
    utmTree.value = []
    sunburstData.value = null
    return
  }

  const totalCount = filteredStats.reduce((sum, stat) => sum + stat.count, 0)
  const tempTree: { [key: string]: any } = {}

  // Сначала строим полное дерево для всех utm_source
  filteredStats.forEach(stat => {
    const source = stat.utm_source || '(не указан)'
    const medium = stat.utm_medium || '(не указан)'
    const campaign = stat.utm_campaign || '(не указан)'
    const content = stat.utm_content || '(не указан)'
    const term = stat.utm_term || '(не указан)'
    const custom = stat.utm_custom || '(не указан)'

    // Level 1: utm_source
    if (!tempTree[source]) {
      tempTree[source] = { count: 0, children: {} }
    }
    tempTree[source].count += stat.count

    // Level 2: utm_medium
    if (!tempTree[source].children[medium]) {
      tempTree[source].children[medium] = { count: 0, children: {} }
    }
    tempTree[source].children[medium].count += stat.count

    // Level 3: utm_campaign
    if (!tempTree[source].children[medium].children[campaign]) {
      tempTree[source].children[medium].children[campaign] = { count: 0, children: {} }
    }
    tempTree[source].children[medium].children[campaign].count += stat.count

    // Level 4: utm_content
    if (!tempTree[source].children[medium].children[campaign].children[content]) {
      tempTree[source].children[medium].children[campaign].children[content] = { count: 0, children: {} }
    }
    tempTree[source].children[medium].children[campaign].children[content].count += stat.count

    // Level 5: utm_term
    if (!tempTree[source].children[medium].children[campaign].children[content].children[term]) {
      tempTree[source].children[medium].children[campaign].children[content].children[term] = { count: 0, children: {} }
    }
    tempTree[source].children[medium].children[campaign].children[content].children[term].count += stat.count

    // Level 6: utm_custom
    if (!tempTree[source].children[medium].children[campaign].children[content].children[term].children[custom]) {
      tempTree[source].children[medium].children[campaign].children[content].children[term].children[custom] = { count: 0 }
    }
    tempTree[source].children[medium].children[campaign].children[content].children[term].children[custom].count += stat.count
  })

  // Находим utm_source с максимальным количеством участников
  const sortedSources = Object.entries(tempTree).sort((a, b) => b[1].count - a[1].count)
  
  if (sortedSources.length === 0) {
    utmTree.value = []
    sunburstData.value = null
    return
  }

  const [mainSource, mainSourceData] = sortedSources[0]
  
  // Функция для глубокого слияния дочерних элементов
  const mergeChildren = (target: any, source: any) => {
    Object.entries(source).forEach(([key, value]: [string, any]) => {
      if (!target[key]) {
        target[key] = { count: 0, children: {} }
      }
      target[key].count += value.count
      
      if (value.children && Object.keys(value.children).length > 0) {
        if (!target[key].children) {
          target[key].children = {}
        }
        mergeChildren(target[key].children, value.children)
      }
    })
  }
  
  // Создаём финальное дерево с одним главным utm_source
  const tree: { [key: string]: any } = {
    [mainSource]: {
      count: totalCount, // Используем общий count для всех участников
      children: JSON.parse(JSON.stringify(mainSourceData.children)) // Глубокое копирование
    }
  }
  
  // Объединяем дочерние элементы остальных utm_source с главным
  sortedSources.slice(1).forEach(([source, sourceData]) => {
    mergeChildren(tree[mainSource].children, sourceData.children)
  })

  // Конвертируем в массив для отображения дерева
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
          percentage: campaignData.count > 0 ? (contentData.count / campaignData.count) * 100 : 0,
          expanded: false,
          children: Object.entries(contentData.children).map(([term, termData]: [string, any]) => ({
            value: term,
            count: termData.count,
            percentage: contentData.count > 0 ? (termData.count / contentData.count) * 100 : 0,
            expanded: false,
            children: Object.entries(termData.children).map(([custom, customData]: [string, any]) => ({
              value: custom,
              count: customData.count,
              percentage: termData.count > 0 ? (customData.count / termData.count) * 100 : 0
            })).sort((a, b) => b.count - a.count)
          })).sort((a, b) => b.count - a.count)
        })).sort((a, b) => b.count - a.count)
      })).sort((a, b) => b.count - a.count)
    })).sort((a, b) => b.count - a.count)
  })).sort((a, b) => b.count - a.count)

  // Строим данные для Sunburst
  buildSunburstData(tree, totalCount)
}

const buildSunburstData = (tree: any, totalCount: number) => {
  const convertToSunburst = (obj: any, level: number = 0): SunburstNode[] => {
    return Object.entries(obj).map(([key, data]: [string, any]) => {
      const node: SunburstNode = {
        name: key,
        value: data.count,
        level
      }
      
      if (data.children && Object.keys(data.children).length > 0) {
        node.children = convertToSunburst(data.children, level + 1)
      }
      
      return node
    }).sort((a, b) => b.value - a.value)
  }

  sunburstData.value = {
    name: 'UTM',
    value: totalCount,
    children: convertToSunburst(tree, 1),
    level: 0
  }
  
  // Логируем для отладки
  console.log('Sunburst data:', sunburstData.value)
  console.log('First level children:', sunburstData.value.children?.length)
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
  
  // Отрисовываем график после загрузки данных
  await nextTick()
  if (sunburstData.value) {
    drawBarChart()
  }
}

// Переключение уровня UTM
const switchLevel = (level: 'medium' | 'campaign' | 'content' | 'term' | 'custom') => {
  currentLevel.value = level
  drawBarChart()
}

// Функция отрисовки столбчатой диаграммы
const drawBarChart = () => {
  if (!sunburstContainer.value || !sunburstData.value || !sunburstData.value.children) return

  // Уничтожаем предыдущий график если есть
  if (chartInstance) {
    chartInstance.destroy()
  }

  // Собираем данные для текущего уровня без фильтров
  const data: { [key: string]: number } = {}
  
  // Уровни: medium(2) -> campaign(3) -> content(4) -> term(5) -> custom(6)
  const levelMapping: { [key: string]: number } = {
    'medium': 2,
    'campaign': 3,
    'content': 4,
    'term': 5,
    'custom': 6
  }
  
  const targetDepth = levelMapping[currentLevel.value]
  
  // Рекурсивная функция для обхода дерева
  const traverse = (node: SunburstNode, depth: number) => {
    // Если это нужный уровень, добавляем в данные
    if (depth === targetDepth) {
      const key = node.name
      data[key] = (data[key] || 0) + node.value
    }
    
    // Продолжаем обход детей если нужно идти глубже
    if (node.children && depth < targetDepth) {
      node.children.forEach(child => {
        traverse(child, depth + 1)
      })
    }
  }
  
  // Начинаем обход с корневого узла (utm_source)
  if (sunburstData.value.children && sunburstData.value.children.length > 0) {
    sunburstData.value.children.forEach(sourceNode => {
      // sourceNode - это главный utm_source (уровень 1)
      // Начинаем обход с его детей
      if (sourceNode.children) {
        sourceNode.children.forEach(mediumNode => {
          // mediumNode - это utm_medium (уровень 2)
          // Если мы на уровне medium, добавляем его сразу
          if (currentLevel.value === 'medium') {
            const key = mediumNode.name
            data[key] = (data[key] || 0) + mediumNode.value
          } else {
            // Иначе продолжаем обход для более глубоких уровней
            traverse(mediumNode, 2)
          }
        })
      }
    })
  }

  const labels = Object.keys(data).sort((a, b) => data[b] - data[a])
  const values = labels.map(label => data[label])

  console.log('Current level:', currentLevel.value)
  console.log('Target depth:', targetDepth)
  console.log('Collected data:', data)
  console.log('Labels:', labels)
  console.log('Values:', values)

  // Если данных нет, не показываем график
  if (labels.length === 0) {
    console.warn('No data collected for current level')
    return
  }

  // Цвета для разных элементов
  const colors = [
    '#3B82F6', // синий
    '#8B5CF6', // фиолетовый  
    '#10B981', // зелёный
    '#F59E0B', // оранжевый
    '#EF4444', // красный
    '#06B6D4', // бирюзовый
    '#EC4899', // розовый
    '#84CC16', // лайм
    '#F97316', // темно-оранжевый
    '#14B8A6', // изумрудный
    '#6366F1', // индиго
    '#F43F5E'  // rose
  ]

  const backgroundColors = labels.map((_, index) => colors[index % colors.length])

  chartInstance = new Chart(sunburstContainer.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `utm_${currentLevel.value}`,
        data: values,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11
            },
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 50
          },
          title: {
            display: true,
            text: 'Количество посетителей'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            title: function(context) {
              return context[0].label
            },
            label: function(context) {
              const value = context.parsed.y
              const total = values.reduce((sum, v) => sum + v, 0)
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
              return [
                `Посетителей: ${value}`,
                `Процент: ${percentage}%`
              ]
            }
          }
        }
      }
    }
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

              <div v-if="!sunburstData" class="text-center py-8 text-gray-500">
                Нет UTM данных
              </div>

              <!-- Столбчатая диаграмма -->
              <div v-else class="mb-8">
                <!-- Выбор уровня UTM -->
                <div class="mb-6 flex items-center gap-3 flex-wrap">
                  <span class="text-sm font-medium text-gray-700">ГРАФИК:</span>
                  <button
                    @click="switchLevel('medium')"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border',
                      currentLevel === 'medium'
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    utm_medium
                  </button>
                  <button
                    @click="switchLevel('campaign')"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border',
                      currentLevel === 'campaign'
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    utm_campaign
                  </button>
                  <button
                    @click="switchLevel('content')"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border',
                      currentLevel === 'content'
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    utm_content
                  </button>
                  <button
                    @click="switchLevel('term')"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border',
                      currentLevel === 'term'
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    utm_term
                  </button>
                  <button
                    @click="switchLevel('custom')"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border',
                      currentLevel === 'custom'
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    utm_custom
                  </button>
                </div>

                <div class="flex flex-col items-center">
                  <div style="height: 400px; width: 100%; position: relative;">
                    <canvas ref="sunburstContainer"></canvas>
                  </div>
                </div>
                
                <!-- Легенда -->
                <div class="mt-6 text-center text-sm text-gray-600">
                  <div class="mb-2 font-medium">Все значения utm_{{ currentLevel }} для этого вебинара</div>
                  <div class="text-xs text-gray-500">
                    Каждый цвет — отдельное значение utm_{{ currentLevel }}
                  </div>
                </div>
              </div>

              <!-- Детальное дерево -->
              <div v-if="utmTree.length > 0" class="mt-8 border-t pt-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Детальная структура</h3>
                <div class="space-y-1">
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
                              <div 
                                @click="toggleNode(content)"
                                class="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                              >
                                <div class="flex items-center gap-2">
                                  <svg 
                                    class="w-4 h-4 text-gray-400 transition-transform"
                                    :class="{ 'rotate-90': content.expanded }"
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span class="text-sm text-gray-500">{{ content.value }}</span>
                                  <span class="text-xs text-gray-400">utm_content</span>
                                </div>
                                <div class="flex items-center gap-4">
                                  <span class="text-sm text-gray-600">{{ content.count }}</span>
                                  <span class="text-sm text-gray-400 w-16 text-right">{{ content.percentage.toFixed(1) }}%</span>
                                </div>
                              </div>

                              <!-- utm_term (уровень 5) -->
                              <div v-if="content.expanded && content.children" class="ml-6 border-l-2 border-gray-100">
                                <div v-for="term in content.children" :key="term.value">
                                  <div 
                                    @click="toggleNode(term)"
                                    class="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                                  >
                                    <div class="flex items-center gap-2">
                                      <svg 
                                        class="w-4 h-4 text-gray-400 transition-transform"
                                        :class="{ 'rotate-90': term.expanded }"
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span class="text-sm text-gray-500">{{ term.value }}</span>
                                      <span class="text-xs text-gray-400">utm_term</span>
                                    </div>
                                    <div class="flex items-center gap-4">
                                      <span class="text-sm text-gray-600">{{ term.count }}</span>
                                      <span class="text-sm text-gray-400 w-16 text-right">{{ term.percentage.toFixed(1) }}%</span>
                                    </div>
                                  </div>

                                  <!-- utm_custom (уровень 6) -->
                                  <div v-if="term.expanded && term.children" class="ml-6 border-l-2 border-gray-50">
                                    <div v-for="custom in term.children" :key="custom.value">
                                      <div class="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                                        <div class="flex items-center gap-2 ml-6">
                                          <span class="text-sm text-gray-400">{{ custom.value }}</span>
                                          <span class="text-xs text-gray-400">utm_custom</span>
                                        </div>
                                        <div class="flex items-center gap-4">
                                          <span class="text-sm text-gray-600">{{ custom.count }}</span>
                                          <span class="text-sm text-gray-400 w-16 text-right">{{ custom.percentage.toFixed(1) }}%</span>
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
