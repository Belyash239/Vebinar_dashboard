<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

// Регистрируем компоненты Chart.js
Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

interface Stats {
  totalWebinars: number
  avgParticipants: number
  avgConversion: number
  avgRetention: number
  totalUsers: number
  popularProduct: string
}

interface TimelineData {
  date: string
  product: string
  participantIds: string
  newParticipantIds: string
}

interface TotalVisitorsData {
  date: string
  totalVisitors: number
}

interface Webinar {
  id: number
  name: string
  tags: string | null
  date: string
}

interface UniqueUser {
  inn: string
  companyName: string | null
  phone: string | null
  emails: string
  products: string
}

const stats = ref<Stats>({
  totalWebinars: 0,
  avgParticipants: 0,
  avgConversion: 0,
  avgRetention: 0,
  totalUsers: 0,
  popularProduct: 'Нет данных'
})

const timelineData = ref<TimelineData[]>([])
const totalVisitorsData = ref<TotalVisitorsData[]>([])
const webinars = ref<Webinar[]>([])
const allWebinars = ref<Webinar[]>([])
const uniqueUsers = ref<UniqueUser[]>([])
const allUniqueUsers = ref<UniqueUser[]>([])
const searchQuery = ref('')
const userSearchQuery = ref('')
const availableTags = ref<string[]>([])
const tagOptions = ref<{ name: string; checked: boolean }[]>([])
const isLoading = ref(false)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const toggleAllChartDatasets = () => {
  if (!chartInstance) return
  
  // Проверяем, все ли datasets видимы
  const allVisible = chartInstance.data.datasets.every((ds, i) => chartInstance!.isDatasetVisible(i))
  
  // Переключаем видимость всех datasets
  chartInstance.data.datasets.forEach((ds, i) => {
    if (allVisible) {
      chartInstance!.hide(i)
    } else {
      chartInstance!.show(i)
    }
  })
  
  chartInstance.update()
}

const selectedTagsCount = computed(() => tagOptions.value.filter(t => t.checked).length)

const fetchStats = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/stats')
    stats.value = await response.json()
  } catch (error) {
    console.error('Error fetching stats:', error)
  }
}

const fetchTimelineData = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/new-clients-timeline')
    timelineData.value = await response.json()
  } catch (error) {
    console.error('Error fetching timeline data:', error)
  }
}

const fetchTotalVisitorsData = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/total-visitors-timeline')
    totalVisitorsData.value = await response.json()
  } catch (error) {
    console.error('Error fetching total visitors data:', error)
  }
}

const fetchWebinars = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/webinars')
    const data = await response.json()
    allWebinars.value = data
    
    // Собираем уникальные теги
    const tagsSet = new Set<string>()
    data.forEach((webinar: Webinar) => {
      if (webinar.tags) {
        webinar.tags.split(', ').forEach(tag => tagsSet.add(tag.trim()))
      }
    })
    
    // Сохраняем текущее состояние выбранных тегов
    const currentSelected = new Set(tagOptions.value.filter(t => t.checked).map(t => t.name))
    
    // Создаём новые опции тегов
    tagOptions.value = Array.from(tagsSet).sort().map(tag => ({
      name: tag,
      checked: currentSelected.has(tag)
    }))
    
    availableTags.value = Array.from(tagsSet).sort()
    
    // Применяем фильтры
    applyWebinarFilters()
  } catch (error) {
    console.error('Error fetching webinars:', error)
  }
}

const fetchUniqueUsers = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/unique-users')
    const data = await response.json()
    allUniqueUsers.value = data
    applyUserFilters()
  } catch (error) {
    console.error('Error fetching unique users:', error)
  }
}

const applyWebinarFilters = () => {
  let filtered = [...allWebinars.value]
  
  // Фильтр по тегам (если выбран хотя бы один)
  const selectedTags = tagOptions.value.filter(t => t.checked).map(t => t.name)
  if (selectedTags.length > 0) {
    filtered = filtered.filter(w => {
      if (!w.tags) return false
      const webinarTags = w.tags.split(', ').map(t => t.trim())
      // Вебинар должен содержать ВСЕ выбранные теги (логика AND)
      return selectedTags.every(selectedTag => webinarTags.includes(selectedTag))
    })
  }
  
  // Поиск по названию
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(w => 
      w.name.toLowerCase().includes(query)
    )
  }
  
  webinars.value = filtered
}

const toggleTag = (tag: { name: string; checked: boolean }) => {
  tag.checked = !tag.checked
  applyWebinarFilters()
}

const clearWebinarFilters = () => {
  searchQuery.value = ''
  tagOptions.value.forEach(tag => tag.checked = false)
  applyWebinarFilters()
}

const applyUserFilters = () => {
  let filtered = [...allUniqueUsers.value]
  
  // Поиск по ИНН или Email
  if (userSearchQuery.value.trim()) {
    const query = userSearchQuery.value.toLowerCase()
    filtered = filtered.filter(u => 
      u.inn.toLowerCase().includes(query) ||
      (u.emails && u.emails.toLowerCase().includes(query))
    )
  }
  
  uniqueUsers.value = filtered
}

const formatEmails = (emails: string | null) => {
  if (!emails) return '—'
  // Разделяем по запятой и выводим каждый email на отдельной строке
  return emails.split(',').map(e => e.trim()).filter(e => e)
}

const formatProducts = (products: string | null) => {
  if (!products) return '—'
  // Убираем пустые значения и оставляем через запятую с пробелом
  return products.split(',').map(p => p.trim()).filter(p => p).join(', ')
}

const clearUserFilters = () => {
  userSearchQuery.value = ''
  applyUserFilters()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
}

const createChart = () => {
  if (!chartCanvas.value || timelineData.value.length === 0) return

  // Уничтожаем предыдущий график если есть
  if (chartInstance) {
    chartInstance.destroy()
  }

  // Оптимизированная обработка данных - данные уже агрегированы с сервера
  const monthGroups: { 
    [monthKey: string]: { 
      [product: string]: { 
        participants: Set<number>,
        firstTimers: Set<number>
      } 
    } 
  } = {}
  
  const allProducts = new Set<string>()

  // Один проход для парсинга агрегированных данных
  timelineData.value.forEach(item => {
    const currentMonth = new Date(item.date).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
    
    allProducts.add(item.product)
    
    if (!monthGroups[currentMonth]) {
      monthGroups[currentMonth] = {}
    }
    
    if (!monthGroups[currentMonth][item.product]) {
      monthGroups[currentMonth][item.product] = {
        participants: new Set(),
        firstTimers: new Set()
      }
    }
    
    // Парсим ID участников из строки
    if (item.participantIds) {
      const ids = item.participantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
      ids.forEach(id => monthGroups[currentMonth][item.product].participants.add(id))
    }
    
    // Парсим ID новых участников
    if (item.newParticipantIds) {
      const newIds = item.newParticipantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
      newIds.forEach(id => monthGroups[currentMonth][item.product].firstTimers.add(id))
    }
  })

  // Сортируем месяцы
  const sortedMonths = Object.keys(monthGroups).sort((a, b) => {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    const [monthA, yearA] = a.split(' ')
    const [monthB, yearB] = b.split(' ')
    const dateA = new Date(parseInt(yearA), months.findIndex(m => monthA.startsWith(m)))
    const dateB = new Date(parseInt(yearB), months.findIndex(m => monthB.startsWith(m)))
    return dateA.getTime() - dateB.getTime()
  })

  const productsList = Array.from(allProducts)

  // Кумулятивное накопление для каждого продукта
  const cumulativeData: { 
    [product: string]: { 
      accumulated: number[], 
      newParticipants: number[] 
    } 
  } = {}

  productsList.forEach(product => {
    cumulativeData[product] = {
      accumulated: [],
      newParticipants: []
    }
    
    const seenParticipants = new Set<number>()
    let previousTotal = 0
    
    sortedMonths.forEach(month => {
      const monthData = monthGroups[month][product]
      
      if (monthData) {
        // Добавляем всех участников этого месяца в накопленные
        monthData.participants.forEach(p => seenParticipants.add(p))
        
        const totalAccumulated = seenParticipants.size
        const newCount = monthData.firstTimers.size
        
        // Накопленная часть = всего накоплено минус новые текущего месяца
        // Но не меньше предыдущего накопленного значения
        const accumulatedOnly = Math.max(previousTotal, totalAccumulated - newCount)
        
        cumulativeData[product].accumulated.push(accumulatedOnly)
        cumulativeData[product].newParticipants.push(newCount)
        
        previousTotal = totalAccumulated
      } else {
        // Если в этом месяце не было данных, используем предыдущее значение
        cumulativeData[product].accumulated.push(previousTotal)
        cumulativeData[product].newParticipants.push(0)
      }
    })
  })

  const labels = sortedMonths

  // Цвета для продуктов
  const baseColors = [
    '#EF4444', '#10B981', '#F59E0B', '#3B82F6', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ]

  const datasets: any[] = []

  // Создаём datasets для накопленных участников
  productsList.forEach((product, index) => {
    const color = baseColors[index % baseColors.length]
    
    datasets.push({
      label: product,
      data: cumulativeData[product].accumulated,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1,
      stack: `stack-${index}`,
      type: 'bar' as const,
      productName: product,
      dataType: 'accumulated'
    })
  })

  // Создаём datasets для новых участников
  productsList.forEach((product, index) => {
    const color = baseColors[index % baseColors.length]
    const lightColor = color + '80'
    
    datasets.push({
      label: product, // Тот же label, чтобы скрыть дубликат в легенде
      data: cumulativeData[product].newParticipants,
      backgroundColor: lightColor,
      borderColor: color,
      borderWidth: 1,
      stack: `stack-${index}`,
      type: 'bar' as const,
      hidden: false,
      productName: product,
      dataType: 'new'
    })
  })

  // Добавляем линию с кумулятивным количеством уникальных участников
  const allParticipantsByMonth: number[] = []
  const allAccumulatedByMonth: number[] = []
  const allNewByMonth: number[] = []
  const seenAllParticipants = new Set<number>()
  let previousTotalAll = 0
  
  sortedMonths.forEach(month => {
    const monthData = monthGroups[month]
    const monthNewParticipants = new Set<number>()
    
    if (monthData) {
      // Собираем всех участников этого месяца по всем продуктам
      Object.values(monthData).forEach(productData => {
        productData.participants.forEach(p => {
          // Если участник новый (не был ранее), добавляем в новые
          if (!seenAllParticipants.has(p)) {
            monthNewParticipants.add(p)
          }
          seenAllParticipants.add(p)
        })
      })
    }
    
    const total = seenAllParticipants.size
    const newCount = monthNewParticipants.size
    const accumulatedOnly = total - newCount
    
    allParticipantsByMonth.push(total)
    allNewByMonth.push(newCount)
    allAccumulatedByMonth.push(accumulatedOnly)
    
    previousTotalAll = total
  })

  datasets.push({
    label: 'Общее количество',
    data: allParticipantsByMonth,
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
    borderWidth: 2,
    type: 'line' as const,
    pointRadius: 4,
    pointHoverRadius: 6,
    yAxisID: 'y',
    order: 0,
    // Добавляем данные для tooltip
    accumulatedData: allAccumulatedByMonth,
    newData: allNewByMonth
  })

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 100
          },
          title: {
            display: true,
            text: 'Посещения'
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'center',
          labels: {
            boxWidth: 15,
            padding: 20,
            font: {
              size: 12
            },
            usePointStyle: true,
            pointStyle: 'circle',
            filter: function(legendItem, chartData) {
              // Показываем только первый dataset для каждого продукта (накопленные)
              // Скрываем дубликаты (новые) из легенды
              const dataset = chartData.datasets[legendItem.datasetIndex]
              return dataset.dataType === 'accumulated' || legendItem.text === 'Общее количество'
            }
          },
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex
            const chart = legend.chart
            
            // При клике на продукт показываем/скрываем оба его dataset (накопленные и новые)
            const clickedDataset = chart.data.datasets[index]
            
            if (clickedDataset.productName) {
              const productName = clickedDataset.productName
              const isCurrentlyVisible = chart.isDatasetVisible(index)
              
              // Находим оба dataset этого продукта и переключаем их видимость
              chart.data.datasets.forEach((ds: any, i) => {
                if (ds.productName === productName) {
                  if (isCurrentlyVisible) {
                    chart.hide(i)
                  } else {
                    chart.show(i)
                  }
                }
              })
            } else {
              // Для линии (общее количество) стандартное поведение
              if (chart.isDatasetVisible(index)) {
                chart.hide(index)
              } else {
                chart.show(index)
              }
            }
            
            chart.update()
          }
        },
        tooltip: {
          mode: 'point',
          intersect: true,
          callbacks: {
            title: function(context) {
              return context[0].label
            },
            label: function(context) {
              const dataset: any = context.dataset
              const value = context.parsed.y
              
              if (dataset.productName) {
                if (dataset.dataType === 'accumulated') {
                  return `${dataset.productName} (накопленные): ${value}`
                } else {
                  return `${dataset.productName} (новые): ${value}`
                }
              } else if (dataset.label === 'Общее количество') {
                // Для линейного графика показываем детали
                const index = context.dataIndex
                const accumulated = dataset.accumulatedData?.[index] || 0
                const newParticipants = dataset.newData?.[index] || 0
                
                return [
                  `${dataset.label}: ${value}`,
                  `Накопленные: ${accumulated}`,
                  `Новые: ${newParticipants}`
                ]
              } else {
                return `${dataset.label}: ${value}`
              }
            }
          }
        }
      }
    }
  })
}

const loadData = async () => {
  isLoading.value = true
  await Promise.all([
    fetchStats(),
    fetchTimelineData(),
    fetchTotalVisitorsData(),
    fetchWebinars(),
    fetchUniqueUsers()
  ])
  isLoading.value = false
  
  // Создаём график после загрузки данных
  await nextTick()
  createChart()
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
      <div v-if="isLoading" class="text-center py-12">
        <div class="text-gray-500">Загрузка данных...</div>
      </div>

      <div v-else>
        <!-- Карточки метрик -->
        <section class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <!-- Всего вебинаров -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Всего вебинаров</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalWebinars }}</div>
            </div>

            <!-- Среднее кол-во участников -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Среднее кол-во участников</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgParticipants }}</div>
            </div>

            <!-- Средняя конверсия -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Средняя конверсия</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgConversion }}%</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Среднее удержание -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Среднее удержание</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgRetention }}%</div>
            </div>

            <!-- Всего уникальных пользователей -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Всего уникальных пользователей</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalUsers }}</div>
            </div>

            <!-- Наиболее популярный продукт -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Наиболее популярный продукт</div>
              <div class="text-2xl font-bold text-gray-900 mt-3">{{ stats.popularProduct }}</div>
            </div>
          </div>
        </section>

        <!-- График новых уникальных клиентов -->
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Динамика посещений по времени (уникальных)</h2>
            <button
              @click="toggleAllChartDatasets"
              class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Показать всё / Скрыть всё
            </button>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <div v-if="timelineData.length === 0" class="text-center py-12 text-gray-500">
              Нет данных для отображения
            </div>
            <div v-else style="height: 400px; position: relative;">
              <canvas ref="chartCanvas"></canvas>
            </div>
          </div>
        </section>

        <!-- Таблица вебинаров -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Список вебинаров</h2>
                
                <div class="flex items-center gap-4">
                  <button
                    @click="clearWebinarFilters"
                    v-if="selectedTagsCount > 0 || searchQuery"
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

              <!-- Фильтры по тегам -->
              <div v-if="tagOptions.length > 0" class="mb-6">
                <div class="flex flex-wrap gap-2">
                  <label 
                    v-for="tag in tagOptions" 
                    :key="tag.name"
                    class="inline-flex items-center px-3 py-1.5 rounded-full border cursor-pointer transition"
                    :class="tag.checked 
                      ? 'bg-blue-100 border-blue-500 text-blue-800' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'"
                  >
                    <input
                      type="checkbox"
                      :checked="tag.checked"
                      @change="toggleTag(tag)"
                      class="sr-only"
                    />
                    <span class="text-sm">{{ tag.name }}</span>
                  </label>
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
                        Теги
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="webinars.length === 0 && (searchQuery || selectedTagsCount > 0)">
                      <td colspan="3" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет вебинаров, соответствующих фильтрам
                      </td>
                    </tr>
                    <tr v-else-if="webinars.length === 0">
                      <td colspan="3" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет импортированных вебинаров
                      </td>
                    </tr>
                    <tr v-else v-for="webinar in webinars" :key="webinar.id" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          :to="`/webinar/${webinar.id}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ webinar.name }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ webinar.tags || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ formatDate(webinar.date) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Таблица уникальных пользователей -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Список пользователей</h2>
                
                <div class="flex items-center gap-4">
                  <button
                    @click="clearUserFilters"
                    v-if="userSearchQuery"
                    class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Filter
                  </button>

                  <div class="relative">
                    <input
                      v-model="userSearchQuery"
                      @input="applyUserFilters"
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
                    <col style="width: 20%;">
                    <col style="width: 12%;">
                    <col style="width: 23%;">
                    <col style="width: 30%;">
                  </colgroup>
                  <thead class="sticky top-0 bg-white z-10">
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        ИНН
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Компания
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Телефон
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Email
                      </th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 bg-white">
                        Продукты
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="uniqueUsers.length === 0 && userSearchQuery">
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет пользователей, соответствующих поиску
                      </td>
                    </tr>
                    <tr v-else-if="uniqueUsers.length === 0">
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        Нет пользователей
                      </td>
                    </tr>
                    <tr v-else v-for="user in uniqueUsers" :key="user.inn" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900 break-words overflow-hidden">
                        <router-link 
                          :to="`/company/${encodeURIComponent(user.inn)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ user.inn }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 break-words overflow-hidden">
                        {{ user.companyName || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 overflow-hidden whitespace-nowrap">
                        {{ user.phone || '—' }}
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
                        {{ formatProducts(user.products) }}
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
