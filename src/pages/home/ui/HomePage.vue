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
  totalRegistrations: number
  popularProduct: string
  avgWebinarsPerPerson: number
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

interface TopCompany {
  inn: string
  companyName: string
  employeeCount: number
  employees: {
    email: string
    position: string
    date: string
    webinarName: string
    webinarId: number
  }[]
}

interface TopWebinar {
  id: number
  name: string
  date: string
  registeredCount: number
  attendedCount: number
  conversion: number
}

interface TopClient {
  email: string
  firstName: string | null
  lastName: string | null
  inn: string | null
  companyName: string | null
  position: string | null
  visitsCount: number
}

const stats = ref<Stats>({
  totalWebinars: 0,
  avgParticipants: 0,
  avgConversion: 0,
  avgRetention: 0,
  totalUsers: 0,
  totalRegistrations: 0,
  popularProduct: 'Нет данных',
  avgWebinarsPerPerson: 0
})

const timelineData = ref<TimelineData[]>([])
const totalVisitorsData = ref<TotalVisitorsData[]>([])
const webinars = ref<Webinar[]>([])
const allWebinars = ref<Webinar[]>([])
const uniqueUsers = ref<UniqueUser[]>([])
const allUniqueUsers = ref<UniqueUser[]>([])
const topCompanies = ref<TopCompany[]>([])
const topWebinars = ref<TopWebinar[]>([])
const topClients = ref<TopClient[]>([])
const webinarSortBy = ref<'attended' | 'registered' | 'conversion'>('attended')
const expandedCompanies = ref<Set<string>>(new Set())
const searchQuery = ref('')
const userSearchQuery = ref('')
const availableTags = ref<string[]>([])
const tagOptions = ref<{ name: string; checked: boolean }[]>([])
const isLoading = ref(false)
const isLoadingUsers = ref(false)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const selectedYears = ref<Set<string>>(new Set(['all'])) // Выбранные года для фильтрации графика
const availableYears = ref<string[]>([]) // Доступные года из данных
const isYearDropdownOpen = ref(false) // Состояние выпадающего списка
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

const toggleYear = (year: string) => {
  if (year === 'all') {
    // Если выбрали "Все года", сбрасываем остальные
    selectedYears.value.clear()
    selectedYears.value.add('all')
  } else {
    // Убираем "Все года" если выбираем конкретный год
    selectedYears.value.delete('all')
    
    if (selectedYears.value.has(year)) {
      selectedYears.value.delete(year)
      // Если не осталось выбранных годов, ставим "Все года"
      if (selectedYears.value.size === 0) {
        selectedYears.value.add('all')
      }
    } else {
      selectedYears.value.add(year)
    }
  }
  
  renderChart()
}

const isYearSelected = (year: string) => {
  return selectedYears.value.has(year)
}

const selectedYearsLabel = computed(() => {
  if (selectedYears.value.has('all')) {
    return 'Все года'
  }
  const years = Array.from(selectedYears.value).sort((a, b) => parseInt(b) - parseInt(a))
  return years.length > 0 ? years.join(', ') : 'Выберите год'
})

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
  isLoadingUsers.value = true
  try {
    const response = await fetch('http://localhost:3000/api/unique-users')
    const data = await response.json()
    allUniqueUsers.value = data
    uniqueUsers.value = data
  } catch (error) {
    console.error('Error fetching unique users:', error)
  } finally {
    isLoadingUsers.value = false
  }
}

const fetchTopCompanies = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/top-companies')
    topCompanies.value = await response.json()
  } catch (error) {
    console.error('Error fetching top companies:', error)
  }
}

const fetchTopWebinars = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/top-webinars?limit=20&sortBy=${webinarSortBy.value}`)
    topWebinars.value = await response.json()
  } catch (error) {
    console.error('Error fetching top webinars:', error)
  }
}

const fetchTopClients = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/top-clients?limit=20')
    topClients.value = await response.json()
  } catch (error) {
    console.error('Error fetching top clients:', error)
  }
}

const changeWebinarSort = async (sortBy: 'attended' | 'registered' | 'conversion') => {
  webinarSortBy.value = sortBy
  await fetchTopWebinars()
}

const toggleCompany = (inn: string) => {
  if (expandedCompanies.value.has(inn)) {
    expandedCompanies.value.delete(inn)
  } else {
    expandedCompanies.value.add(inn)
  }
}

const isCompanyExpanded = (inn: string) => {
  return expandedCompanies.value.has(inn)
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

const applyUserFilters = async () => {
  // Если есть поисковый запрос - делаем запрос к серверу для поиска по всей БД
  if (userSearchQuery.value.trim()) {
    isLoadingUsers.value = true
    try {
      const query = encodeURIComponent(userSearchQuery.value.trim())
      const response = await fetch(`http://localhost:3000/api/search-users?q=${query}`)
      const data = await response.json()
      uniqueUsers.value = data
    } catch (error) {
      console.error('Error searching users:', error)
      uniqueUsers.value = []
    } finally {
      isLoadingUsers.value = false
    }
  } else {
    // Если поиска нет - показываем начальный список (1000 последних)
    uniqueUsers.value = allUniqueUsers.value
  }
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

const renderChart = () => {
  createChart()
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
  const yearsSet = new Set<string>()

  // ПЕРВЫЙ ПРОХОД: собираем все доступные года
  timelineData.value.forEach(item => {
    const date = new Date(item.date)
    const year = date.getFullYear().toString()
    yearsSet.add(year)
  })
  
  // Обновляем список доступных годов
  availableYears.value = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a))

  // ВТОРОЙ ПРОХОД: парсим ВСЕ данные для накопления участников
  // Сначала собираем всех участников до выбранного года для начального накопленного значения
  const allSeenParticipantsByProduct: { [product: string]: Set<number> } = {}
  const allSeenParticipants = new Set<number>()
  
  // Сортируем данные по дате для правильного накопления
  const sortedTimelineData = [...timelineData.value].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  sortedTimelineData.forEach(item => {
    const date = new Date(item.date)
    const year = date.getFullYear().toString()
    const currentMonth = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
    
    allProducts.add(item.product)
    
    // Инициализируем Set для продукта если нужно
    if (!allSeenParticipantsByProduct[item.product]) {
      allSeenParticipantsByProduct[item.product] = new Set()
    }
    
    // Парсим ID участников из строки
    let participantIds: number[] = []
    if (item.participantIds) {
      participantIds = item.participantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
    }
    
    // Парсим ID новых участников
    let newParticipantIds: number[] = []
    if (item.newParticipantIds) {
      newParticipantIds = item.newParticipantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
    }
    
    // Добавляем всех участников в глобальные накопители
    participantIds.forEach(id => {
      allSeenParticipantsByProduct[item.product].add(id)
      allSeenParticipants.add(id)
    })
    
    // Если этот месяц входит в выбранные года (или выбраны все года), добавляем в monthGroups
    if (selectedYears.value.has('all') || selectedYears.value.has(year)) {
      if (!monthGroups[currentMonth]) {
        monthGroups[currentMonth] = {}
      }
      
      if (!monthGroups[currentMonth][item.product]) {
        monthGroups[currentMonth][item.product] = {
          participants: new Set(),
          firstTimers: new Set()
        }
      }
      
      // Добавляем участников в группу месяца
      participantIds.forEach(id => monthGroups[currentMonth][item.product].participants.add(id))
      newParticipantIds.forEach(id => monthGroups[currentMonth][item.product].firstTimers.add(id))
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
    
    // Начинаем с участников, которые были до первого отображаемого месяца
    const seenParticipants = new Set<number>(allSeenParticipantsByProduct[product] || [])
    let previousTotal = seenParticipants.size
    
    // Если не выбраны все года, нужно вычислить начальное накопленное значение
    if (!selectedYears.value.has('all') && sortedMonths.length > 0) {
      // Находим дату первого отображаемого месяца
      const firstDisplayedMonth = sortedMonths[0]
      const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
      const [monthName, yearStr] = firstDisplayedMonth.split(' ')
      const firstMonthIndex = months.findIndex(m => monthName.startsWith(m))
      const firstMonthDate = new Date(parseInt(yearStr), firstMonthIndex, 1)
      
      // Считаем всех участников до этой даты
      const participantsBeforeFirstMonth = new Set<number>()
      sortedTimelineData.forEach(item => {
        if (item.product === product && new Date(item.date) < firstMonthDate) {
          if (item.participantIds) {
            const ids = item.participantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
            ids.forEach(id => participantsBeforeFirstMonth.add(id))
          }
        }
      })
      
      previousTotal = participantsBeforeFirstMonth.size
    } else {
      previousTotal = 0
    }
    
    sortedMonths.forEach(month => {
      const monthData = monthGroups[month][product]
      
      if (monthData) {
        // Пересчитываем накопленных участников с учётом всех предыдущих
        const seenInThisMonth = new Set<number>()
        
        // Собираем всех участников до этого месяца включительно
        const [currentMonthName, currentYear] = month.split(' ')
        const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
        const currentMonthIndex = months.findIndex(m => currentMonthName.startsWith(m))
        const currentMonthDate = new Date(parseInt(currentYear), currentMonthIndex + 1, 0) // Последний день месяца
        
        sortedTimelineData.forEach(item => {
          if (item.product === product && new Date(item.date) <= currentMonthDate) {
            if (item.participantIds) {
              const ids = item.participantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
              ids.forEach(id => seenInThisMonth.add(id))
            }
          }
        })
        
        const totalAccumulated = seenInThisMonth.size
        const newCount = monthData.firstTimers.size
        
        // Накопленная часть = всего накоплено минус новые текущего месяца
        const accumulatedOnly = Math.max(0, totalAccumulated - newCount)
        
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
  
  sortedMonths.forEach(month => {
    const monthData = monthGroups[month]
    
    // Вычисляем общее количество участников до этого месяца включительно
    const [currentMonthName, currentYear] = month.split(' ')
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    const currentMonthIndex = months.findIndex(m => currentMonthName.startsWith(m))
    const currentMonthDate = new Date(parseInt(currentYear), currentMonthIndex + 1, 0) // Последний день месяца
    
    const seenAllUpToThisMonth = new Set<number>()
    sortedTimelineData.forEach(item => {
      if (new Date(item.date) <= currentMonthDate) {
        if (item.participantIds) {
          const ids = item.participantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0)
          ids.forEach(id => seenAllUpToThisMonth.add(id))
        }
      }
    })
    
    // Новые участники этого месяца
    const monthNewParticipants = new Set<number>()
    if (monthData) {
      Object.values(monthData).forEach(productData => {
        productData.firstTimers.forEach(id => monthNewParticipants.add(id))
      })
    }
    
    const total = seenAllUpToThisMonth.size
    const newCount = monthNewParticipants.size
    const accumulatedOnly = total - newCount
    
    allParticipantsByMonth.push(total)
    allNewByMonth.push(newCount)
    allAccumulatedByMonth.push(Math.max(0, accumulatedOnly))
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
    fetchUniqueUsers(),
    fetchTopCompanies(),
    fetchTopWebinars(),
    fetchTopClients()
  ])
  isLoading.value = false
  
  // Создаём график после загрузки данных
  await nextTick()
  renderChart()
}

onMounted(() => {
  loadData()
  
  // Закрываем dropdown при клике вне его
  document.addEventListener('click', () => {
    isYearDropdownOpen.value = false
  })
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
      <div v-if="isLoading" class="text-center py-12">
        <div class="text-gray-500">Загрузка данных...</div>
      </div>

      <div v-else>
        <!-- Карточки метрик -->
        <section class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <!-- Всего регистраций -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Всего регистраций</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Общее количество регистраций на все вебинары
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalRegistrations }}</div>
            </div>

            <!-- Всего уникальных пользователей -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Всего уникальных пользователей</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Общее количество уникальных участников в системе
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalUsers }}</div>
            </div>

            <!-- Средняя конверсия -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Средняя конверсия</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Средний процент зарегистрированных, которые посетили вебинары
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgConversion }}%</div>
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
                    Средний процент присутствия участников на вебинарах
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgRetention }}%</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <!-- Всего посещений -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Всего посещений</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Общее количество посещений вебинаров (присутствие >= 1 минуты)
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalWebinars }}</div>
            </div>

            <!-- Среднее кол-во участников -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Среднее кол-во участников</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Среднее количество участников на одном вебинаре
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgParticipants }}</div>
            </div>

            <!-- Среднее количество посещённых вебинаров на человека -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Среднее кол-во посещённых вебинаров на человека</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Отношение общего числа посещений к числу уникальных участников
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgWebinarsPerPerson }}</div>
            </div>

            <!-- Наиболее популярный продукт -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>Наиболее популярный продукт</span>
                <div class="relative group">
                  <svg class="w-4 h-4 text-gray-400 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Продукт с наибольшим количеством регистраций на вебинары
                    <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900 mt-3">{{ stats.popularProduct }}</div>
            </div>
          </div>
        </section>

        <!-- График новых уникальных клиентов -->
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Динамика посещений по времени (уникальных)</h2>
            <div class="flex items-center gap-3">
              <!-- Выпадающий список с чекбоксами -->
              <div class="relative">
                <label class="text-sm text-gray-600 mr-2">Год:</label>
                <button
                  @click.stop="isYearDropdownOpen = !isYearDropdownOpen"
                  class="inline-flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 min-w-[150px]"
                >
                  <span>{{ selectedYearsLabel }}</span>
                  <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                <!-- Выпадающее меню -->
                <div
                  v-if="isYearDropdownOpen"
                  @click.stop
                  class="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50"
                >
                  <div class="py-2">
                    <!-- Кнопка "Все года" (сброс) -->
                    <button
                      @click="toggleYear('all')"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                      :class="isYearSelected('all') ? 'bg-blue-50 text-blue-700 font-medium' : ''"
                    >
                      <span>Все года</span>
                      <svg v-if="isYearSelected('all')" class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </button>
                    
                    <!-- Разделитель -->
                    <div class="border-t border-gray-200 my-1"></div>
                    
                    <!-- Отдельные года -->
                    <label 
                      v-for="year in availableYears" 
                      :key="year"
                      class="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :checked="isYearSelected(year)"
                        @change="toggleYear(year)"
                        class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-sm text-gray-700">{{ year }}</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <button
                @click="toggleAllChartDatasets"
                class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Показать всё / Скрыть всё
              </button>
            </div>
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

              <!-- Таблица с прокруткой -->
              <div class="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                <table class="min-w-full">
                  <thead class="bg-gray-50 sticky top-0">
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
                  <tbody class="bg-white">
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

        <!-- Топ вебинаров по посещениям -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900">Топ-20 вебинаров</h2>
                
                <!-- Кнопки выбора критерия сортировки -->
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-600 mr-2">Сортировка:</span>
                  <button
                    @click="changeWebinarSort('attended')"
                    class="px-3 py-1.5 text-sm rounded-lg transition"
                    :class="webinarSortBy === 'attended' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                  >
                    По посещениям
                  </button>
                  <button
                    @click="changeWebinarSort('registered')"
                    class="px-3 py-1.5 text-sm rounded-lg transition"
                    :class="webinarSortBy === 'registered' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                  >
                    По регистрациям
                  </button>
                  <div class="relative group">
                    <button
                      @click="changeWebinarSort('conversion')"
                      class="px-3 py-1.5 text-sm rounded-lg transition"
                      :class="webinarSortBy === 'conversion' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                    >
                      По конверсии
                    </button>
                    <div class="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                      Средний процент зарегистрированных, которые посетили вебинары
                      <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-if="topWebinars.length === 0" class="text-center py-8 text-gray-500">
                Нет данных о вебинарах
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-gray-50">
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 w-12">#</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">Название вебинара</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 text-center">Дата</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 text-center">Зарегистрировано</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 text-center">Посетило</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 text-center">Конверсия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr 
                      v-for="(webinar, index) in topWebinars" 
                      :key="webinar.id"
                      class="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td class="px-6 py-4 text-sm text-gray-500 font-medium">
                        {{ index + 1 }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          :to="`/webinar/${webinar.id}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {{ webinar.name }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 text-center">
                        {{ formatDate(webinar.date) }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 text-center">
                        {{ webinar.registeredCount }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 text-center">
                        {{ webinar.attendedCount }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 text-center">
                        {{ webinar.conversion }}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Топ-20 компаний с 5+ сотрудниками -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <h2 class="text-xl font-semibold text-gray-900 mb-6">Топ-20 компаний (более 5 сотрудников посетили вебинары)</h2>
              
              <div v-if="topCompanies.length === 0" class="text-center py-8 text-gray-500">
                Нет компаний, соответствующих критериям
              </div>

              <div v-else class="space-y-4">
                <div 
                  v-for="(company, index) in topCompanies" 
                  :key="company.inn"
                  class="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <!-- Заголовок компании -->
                  <div 
                    @click="toggleCompany(company.inn)"
                    class="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <div class="flex items-center gap-4">
                      <div class="text-lg font-semibold text-gray-400 w-8">
                        {{ index + 1 }}
                      </div>
                      <div>
                        <router-link 
                          :to="`/company/${encodeURIComponent(company.inn)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          @click.stop
                        >
                          {{ company.companyName }}
                        </router-link>
                        <div class="text-sm text-gray-500">
                          ИНН: 
                          <router-link 
                            :to="`/company/${encodeURIComponent(company.inn)}`"
                            class="text-blue-600 hover:text-blue-800 hover:underline"
                            @click.stop
                          >
                            {{ company.inn }}
                          </router-link>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <div class="text-right">
                        <div class="text-sm text-gray-600">Сотрудников посетило</div>
                        <div class="text-2xl font-bold text-gray-900">{{ company.employeeCount }}</div>
                      </div>
                      <svg 
                        class="w-5 h-5 text-gray-400 transition-transform"
                        :class="{ 'rotate-180': isCompanyExpanded(company.inn) }"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <!-- Список сотрудников -->
                  <div v-if="isCompanyExpanded(company.inn)" class="border-t border-gray-200 bg-gray-50">
                    <div class="p-4">
                      <div class="border border-gray-200 rounded">
                        <table class="w-full table-fixed">
                          <colgroup>
                            <col style="width: 25%;">
                            <col style="width: 20%;">
                            <col style="width: 35%;">
                            <col style="width: 20%;">
                          </colgroup>
                          <thead class="bg-gray-100">
                            <tr class="text-left text-sm text-gray-600 border-b border-gray-200">
                              <th class="pb-2 pt-2 px-3">Email</th>
                              <th class="pb-2 pt-2 px-3">Должность</th>
                              <th class="pb-2 pt-2 px-3">Вебинар</th>
                              <th class="pb-2 pt-2 px-3 text-center">Дата посещения</th>
                            </tr>
                          </thead>
                        </table>
                        
                        <!-- Прокручиваемое тело таблицы -->
                        <div class="max-h-80 overflow-y-auto">
                          <table class="w-full table-fixed">
                            <colgroup>
                              <col style="width: 25%;">
                              <col style="width: 20%;">
                              <col style="width: 35%;">
                              <col style="width: 20%;">
                            </colgroup>
                            <tbody>
                              <tr 
                                v-for="(employee, idx) in company.employees" 
                                :key="`${employee.email}-${idx}`"
                                class="text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50"
                              >
                                <td class="py-2 px-3 break-words">
                                  <router-link 
                                    :to="`/participant/${encodeURIComponent(employee.email)}`"
                                    class="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {{ employee.email }}
                                  </router-link>
                                </td>
                                <td class="py-2 px-3 text-gray-700 break-words">
                                  {{ employee.position }}
                                </td>
                                <td class="py-2 px-3 break-words">
                                  <router-link 
                                    :to="`/webinar/${employee.webinarId}`"
                                    class="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {{ employee.webinarName }}
                                  </router-link>
                                </td>
                                <td class="py-2 px-3 text-gray-600 text-center">
                                  {{ formatDate(employee.date) }}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Топ-20 клиентов по посещениям -->
        <section class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              <h2 class="text-xl font-semibold text-gray-900 mb-6">Топ-20 клиентов по посещениям</h2>
              
              <div v-if="topClients.length === 0" class="text-center py-8 text-gray-500">
                Нет данных о клиентах
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-gray-50">
                    <tr class="border-b border-gray-200">
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 w-12">#</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">Имя</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">Компания</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500">Должность</th>
                      <th class="px-6 py-3 text-left text-sm font-medium text-gray-500 text-center">Посещений</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr 
                      v-for="(client, index) in topClients" 
                      :key="client.email"
                      class="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td class="px-6 py-4 text-sm text-gray-500 font-medium">
                        {{ index + 1 }}
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <router-link 
                          :to="`/participant/${encodeURIComponent(client.email)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {{ client.email }}
                        </router-link>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {{ client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <router-link 
                          v-if="client.inn"
                          :to="`/company/${encodeURIComponent(client.inn)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {{ client.companyName || client.inn }}
                        </router-link>
                        <span v-else>—</span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ client.position || '—' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {{ client.visitsCount }}
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
                <div v-if="isLoadingUsers" class="py-12 text-center text-gray-500">
                  Загрузка пользователей...
                </div>
                <table v-else class="w-full table-fixed">
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
                    <tr v-else v-for="user in uniqueUsers" :key="user.inn || user.emails" class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900 break-words overflow-hidden">
                        <router-link 
                          v-if="user.inn"
                          :to="`/company/${encodeURIComponent(user.inn)}`"
                          class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {{ user.inn }}
                        </router-link>
                        <span v-else>—</span>
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
