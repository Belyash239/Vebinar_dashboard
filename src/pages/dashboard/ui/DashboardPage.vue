<script setup lang="ts">
import { ref, onMounted } from 'vue'
import WebinarList from '@/widgets/webinar-list/ui/WebinarList.vue'
import SurveyList from '@/widgets/survey-list/ui/SurveyList.vue'
import ImportModal from '@/features/upload-files/ui/ImportModal.vue'
import SurveyImportModal from '@/features/upload-files/ui/SurveyImportModal.vue'
import BulkImportModal from '@/features/upload-files/ui/BulkImportModal.vue'

interface Tag {
  id: number
  name: string
}

const showImportModal = ref(false)
const showExportModal = ref(false)
const showSurveyImportModal = ref(false)
const showBulkImportModal = ref(false)
const showSuccessNotification = ref(false)
const successMessage = ref('')
const webinarListRef = ref<InstanceType<typeof WebinarList> | null>(null)
const surveyListRef = ref<InstanceType<typeof SurveyList> | null>(null)
const selectedTags = ref<number[]>([])
const tags = ref<Tag[]>([])
const isExporting = ref(false)
const exportType = ref<'tags' | 'inn' | 'positions'>('tags')
const innFile = ref<File | null>(null)
const innFileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// Структурированный список должностей с группировкой
interface PositionGroup {
  name: string
  expanded: boolean
  positions: string[]
}

const positionGroups = ref<PositionGroup[]>([
  {
    name: 'Бухгалтеры',
    expanded: false,
    positions: [
      'Главный бухгалтер',
      'Штатный бухгалтер',
      'Бухгалтер на аутсорсе (частная практика)',
      'Заместитель главного бухгалтера',
      'Ведущий бухгалтер',
      'Старший бухгалтер',
      'Бухгалтер-материалист',
      'Руководитель / владелец бухгалтерской фирмы'
    ]
  },
  {
    name: 'Директора и руководители высшего звена',
    expanded: false,
    positions: [
      'Генеральный директор/ Директор',
      'Исполнительный директор',
      'Коммерческий директор',
      'Финансовый директор',
      'Директор по логистике',
      'ИТ-директор',
      'Директор по развитию',
      'Директор по снабжению',
      'Директор по закупкам',
      'Директор по транспорту',
      'Операционный директор',
      'Заместитель генерального директора/директора'
    ]
  },
  {
    name: 'Руководители отделов и департаментов',
    expanded: false,
    positions: [
      'Руководитель отдела / Начальник отдела',
      'Руководитель департамента',
      'Руководитель группы',
      'Руководитель ИТ / Начальник отдела ИТ / Начальник департамента ИТ и связи',
      'Руководитель отдела логистики / Начальник отдела логистики',
      'Руководитель отдела транспортной логистики',
      'Руководитель отдела продаж',
      'Руководитель отдела закупок',
      'Руководитель отдела снабжения',
      'Руководитель отдела сопровождения',
      'Руководитель юридического отдела'
    ]
  },
  {
    name: 'ИТ-специалисты',
    expanded: false,
    positions: [
      'Инженер-программист',
      'Программист 1С',
      'Системный администратор',
      'Системный аналитик',
      'Бизнес-аналитик',
      'Аналитик 1С',
      'Инженер по сопровождению ПП 1С',
      'Сервис-инженер / Старший сервис-инженер / Ведущий сервис-инженер',
      'Технический специалист',
      'Специалист по внедрению ПО / Специалист по внедрению ИС',
      'Специалист по информационным системам',
      'Функциональный архитектор / Функциональный архитектор 1С'
    ]
  },
  {
    name: 'Консультанты',
    expanded: false,
    positions: [
      'Консультант / Специалист-консультант',
      'Консультант 1С',
      'Ведущий консультант / Ведущий консультант 1С',
      'Старший консультант / Старший консультант 1С',
      'Консультант-аналитик',
      'Консультант по внедрению и поддержке'
    ]
  },
  {
    name: 'Логисты',
    expanded: false,
    positions: [
      'Логист / Ведущий логист',
      'Менеджер по логистике',
      'Специалист по логистике / Старший специалист по логистике',
      'Аналитик транспортной логистики',
      'Специалист по транспортной логистике',
      'Диспетчер',
      'Экспедитор'
    ]
  },
  {
    name: 'Менеджеры',
    expanded: false,
    positions: [
      'Менеджер по работе с клиентами / Клиент-менеджер',
      'Менеджер по сопровождению',
      'Менеджер по продажам',
      'Менеджер по развитию',
      'Менеджер проектов / Проектный менеджер / Руководитель проектов',
      'Менеджер по закупкам',
      'Менеджер по транспорту',
      'Старший менеджер',
      'Ведущий менеджер'
    ]
  },
  {
    name: 'Юристы',
    expanded: false,
    positions: [
      'Юрист',
      'Юрисконсульт',
      'Главный юрисконсульт',
      'Ведущий юрисконсульт',
      'Старший юрист',
      'Налоговый юрист',
      'Юрист по IT',
      'Руководитель юридического департамента'
    ]
  },
  {
    name: 'Специалисты',
    expanded: false,
    positions: [
      'Специалист / Ведущий специалист / Главный специалист / Старший специалист',
      'Специалист 1С / 1С специалист',
      'Специалист по сопровождению / Специалист по сопровождению сервисов',
      'Специалист технической поддержки',
      'Специалист отдела логистики',
      'Специалист ВЭД'
    ]
  },
  {
    name: 'Предприниматели и владельцы',
    expanded: false,
    positions: [
      'Индивидуальный предприниматель / ИП',
      'Руководитель / собственник бизнеса',
      'Собственник/владелец бизнеса',
      'Предприниматель',
      'Учредитель'
    ]
  },
  {
    name: 'Прочие должности',
    expanded: false,
    positions: [
      'Методист',
      'Экономист',
      'Аудитор',
      'Офис-менеджер',
      'Помощник директора',
      'Кладовщик',
      'Водитель',
      'Мастер производства',
      'Механик',
      'Инженер',
      'Товаровед',
      'Администратор',
      'Делопроизводитель',
      'Копирайтер',
      'Маркетолог',
      'Оператор',
      'Самозанятый'
    ]
  }
])

const selectedPositions = ref<string[]>([])

// Функция для переключения группы
const toggleGroup = (group: PositionGroup) => {
  group.expanded = !group.expanded
}

// Функция для проверки, выбраны ли все должности в группе
const isGroupFullySelected = (group: PositionGroup) => {
  return group.positions.every(pos => selectedPositions.value.includes(pos))
}

// Функция для проверки, выбрана ли хотя бы одна должность в группе
const isGroupPartiallySelected = (group: PositionGroup) => {
  return group.positions.some(pos => selectedPositions.value.includes(pos)) && !isGroupFullySelected(group)
}

// Функция для выбора/снятия всех должностей в группе
const toggleGroupSelection = (group: PositionGroup) => {
  if (isGroupFullySelected(group)) {
    // Снимаем все должности этой группы
    selectedPositions.value = selectedPositions.value.filter(pos => !group.positions.includes(pos))
  } else {
    // Добавляем все должности этой группы
    group.positions.forEach(pos => {
      if (!selectedPositions.value.includes(pos)) {
        selectedPositions.value.push(pos)
      }
    })
  }
}

const openImportModal = () => {
  showImportModal.value = true
}

const closeImportModal = () => {
  showImportModal.value = false
}

const handleImportSuccess = () => {
  webinarListRef.value?.fetchWebinars()
  surveyListRef.value?.fetchSurveys()  // Обновляем список опросов на случай если был загружен файл опросов
  successMessage.value = 'Вебинар успешно импортирован!'
  showSuccessNotification.value = true
  
  // Автоматически скрыть уведомление через 3 секунды
  setTimeout(() => {
    showSuccessNotification.value = false
  }, 3000)
}

const openSurveyImportModal = () => {
  showSurveyImportModal.value = true
}

const closeSurveyImportModal = () => {
  showSurveyImportModal.value = false
}

const handleSurveyImportSuccess = () => {
  // Обновляем список опросов
  surveyListRef.value?.fetchSurveys()
  
  successMessage.value = 'Опросы успешно импортированы!'
  showSuccessNotification.value = true
  
  // Автоматически скрыть уведомление через 3 секунды
  setTimeout(() => {
    showSuccessNotification.value = false
  }, 3000)
}

const openBulkImportModal = () => {
  showBulkImportModal.value = true
}

const closeBulkImportModal = () => {
  showBulkImportModal.value = false
}

const handleBulkImportSuccess = () => {
  // Обновляем все списки
  webinarListRef.value?.fetchWebinars()
  surveyListRef.value?.fetchSurveys()
  
  successMessage.value = 'Данные успешно импортированы!'
  showSuccessNotification.value = true
  
  // Автоматически скрыть уведомление через 3 секунды
  setTimeout(() => {
    showSuccessNotification.value = false
  }, 3000)
}

const openExportModal = () => {
  showExportModal.value = true
  fetchTags()
}

const closeExportModal = () => {
  showExportModal.value = false
  selectedTags.value = []
  selectedPositions.value = []
  exportType.value = 'tags'
  innFile.value = null
  if (innFileInput.value) {
    innFileInput.value.value = ''
  }
}

const handleInnFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    innFile.value = target.files[0]
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension === 'txt' || extension === 'xlsx') {
      innFile.value = file
    } else {
      alert('Пожалуйста, загрузите файл формата .txt или .xlsx')
    }
  }
}

const triggerFileInput = () => {
  innFileInput.value?.click()
}

const fetchTags = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/tags')
    tags.value = await response.json()
  } catch (error) {
    console.error('Error fetching tags:', error)
  }
}

const toggleTag = (tagId: number) => {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

const toggleAllTags = () => {
  if (selectedTags.value.length === tags.value.length) {
    // Снять все
    selectedTags.value = []
  } else {
    // Выбрать все
    selectedTags.value = tags.value.map(tag => tag.id)
  }
}

const togglePosition = (position: string) => {
  const index = selectedPositions.value.indexOf(position)
  if (index > -1) {
    selectedPositions.value.splice(index, 1)
  } else {
    selectedPositions.value.push(position)
  }
}

const toggleAllPositions = () => {
  // Собираем все должности из всех групп
  const allPositions = positionGroups.value.flatMap(group => group.positions)
  
  if (selectedPositions.value.length === allPositions.length) {
    selectedPositions.value = []
  } else {
    selectedPositions.value = [...allPositions]
  }
}

const handleExport = async () => {
  if (exportType.value === 'tags') {
    if (selectedTags.value.length === 0) {
      alert('Выберите хотя бы один тег')
      return
    }

    isExporting.value = true

    try {
      const response = await fetch('http://localhost:3000/api/export/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tagIds: selectedTags.value })
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tags_export.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      closeExportModal()
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Ошибка при экспорте данных')
    } finally {
      isExporting.value = false
    }
  } else if (exportType.value === 'positions') {
    if (selectedPositions.value.length === 0) {
      alert('Выберите хотя бы одну должность')
      return
    }

    isExporting.value = true

    try {
      const response = await fetch('http://localhost:3000/api/export/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ positions: selectedPositions.value })
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'positions_export.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      closeExportModal()
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Ошибка при экспорте данных')
    } finally {
      isExporting.value = false
    }
  } else if (exportType.value === 'inn') {
    if (!innFile.value) {
      alert('Загрузите файл с ИНН')
      return
    }

    isExporting.value = true

    try {
      const formData = new FormData()
      formData.append('file', innFile.value)

      console.log('Отправка файла на экспорт по ИНН:', innFile.value.name)

      const response = await fetch('http://localhost:3000/api/export/inn', {
        method: 'POST',
        body: formData
      })

      console.log('Ответ сервера:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Ошибка от сервера:', errorData)
        throw new Error(errorData.error || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inn_export.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log('Экспорт завершён успешно')
      closeExportModal()
    } catch (error) {
      console.error('Error exporting:', error)
      alert(`Ошибка при экспорте данных по ИНН: ${error}`)
    } finally {
      isExporting.value = false
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <router-link to="/" class="text-2xl font-semibold text-gray-900 hover:text-gray-700 cursor-pointer">
          Дашборд по вебинарам
        </router-link>
        <router-link 
          to="/"
          class="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition"
        >
          Главная
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
          <span class="text-gray-900">Управление данными</span>
        </nav>
      </div>

      <WebinarList 
        ref="webinarListRef"
        @open-import="openImportModal"
        @open-export="openExportModal"
        @open-survey-import="openSurveyImportModal"
        @open-bulk-import="openBulkImportModal"
      />

      <!-- Список опросов -->
      <div class="mt-6">
        <SurveyList ref="surveyListRef" />
      </div>
    </main>

    <ImportModal 
      v-if="showImportModal" 
      @close="closeImportModal"
      @success="handleImportSuccess"
    />

    <SurveyImportModal 
      v-if="showSurveyImportModal" 
      @close="closeSurveyImportModal"
      @success="handleSurveyImportSuccess"
    />

    <BulkImportModal 
      v-if="showBulkImportModal" 
      @close="closeBulkImportModal"
      @success="handleBulkImportSuccess"
    />

    <!-- Success Notification -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div 
        v-if="showSuccessNotification"
        class="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 flex items-center gap-3 max-w-md"
      >
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-green-900">{{ successMessage }}</p>
        </div>
        <button
          @click="showSuccessNotification = false"
          class="flex-shrink-0 text-green-600 hover:text-green-800"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Export Modal -->
    <div v-if="showExportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-8">
          <div class="flex items-center justify-between mb-8">
            <h2 class="text-3xl font-semibold text-gray-900">Экспорт данных</h2>
            <button
              @click="closeExportModal"
              class="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div class="space-y-6">
            <!-- Переключатель типа экспорта -->
            <div class="flex gap-4 border-b border-gray-200 pb-4">
              <button
                @click="exportType = 'tags'"
                :class="[
                  'px-4 py-2 rounded-lg font-medium transition',
                  exportType === 'tags'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                ]"
              >
                По тегам
              </button>
              <button
                @click="exportType = 'positions'"
                :class="[
                  'px-4 py-2 rounded-lg font-medium transition',
                  exportType === 'positions'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                ]"
              >
                По должностям
              </button>
              <button
                @click="exportType = 'inn'"
                :class="[
                  'px-4 py-2 rounded-lg font-medium transition',
                  exportType === 'inn'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                ]"
              >
                По ИНН
              </button>
            </div>

            <!-- Экспорт по тегам -->
            <div v-if="exportType === 'tags'">
              <div class="flex items-center justify-between mb-3">
                <label class="block text-lg font-medium text-gray-900">
                  Выберите теги для экспорта
                </label>
                <button
                  @click="toggleAllTags"
                  class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {{ selectedTags.length === tags.length ? 'Снять всё' : 'Выбрать всё' }}
                </button>
              </div>
              <div class="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                <div v-if="tags.length === 0" class="text-sm text-gray-500 text-center py-4">
                  Нет доступных тегов
                </div>
                <label
                  v-for="tag in tags"
                  :key="tag.id"
                  class="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="selectedTags.includes(tag.id)"
                    @change="toggleTag(tag.id)"
                    class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span class="text-sm text-gray-700">{{ tag.name }}</span>
                </label>
              </div>
              <div v-if="selectedTags.length > 0" class="mt-2 text-sm text-gray-600">
                Выбрано тегов: {{ selectedTags.length }}
              </div>
            </div>

            <!-- Экспорт по должностям -->
            <div v-if="exportType === 'positions'">
              <div class="flex items-center justify-between mb-3">
                <label class="block text-lg font-medium text-gray-900">
                  Выберите должности для экспорта
                </label>
                <button
                  @click="toggleAllPositions"
                  class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {{ selectedPositions.length === positionGroups.flatMap(g => g.positions).length ? 'Снять всё' : 'Выбрать всё' }}
                </button>
              </div>
              <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                <!-- Группы должностей -->
                <div
                  v-for="group in positionGroups"
                  :key="group.name"
                  class="border border-gray-200 rounded-lg bg-white overflow-hidden"
                >
                  <!-- Заголовок группы -->
                  <div
                    @click="toggleGroup(group)"
                    class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition"
                  >
                    <div class="flex items-center gap-3">
                      <!-- Чекбокс группы -->
                      <input
                        type="checkbox"
                        :checked="isGroupFullySelected(group)"
                        :indeterminate="isGroupPartiallySelected(group)"
                        @click.stop="toggleGroupSelection(group)"
                        class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <!-- Иконка раскрытия -->
                      <svg
                        class="w-5 h-5 text-gray-500 transition-transform"
                        :class="{ 'rotate-90': group.expanded }"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <!-- Название группы -->
                      <span class="text-sm font-semibold text-gray-900">{{ group.name }}</span>
                      <span class="text-xs text-gray-500">({{ group.positions.length }})</span>
                    </div>
                    <!-- Счетчик выбранных -->
                    <span
                      v-if="group.positions.some(pos => selectedPositions.includes(pos))"
                      class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium"
                    >
                      {{ group.positions.filter(pos => selectedPositions.includes(pos)).length }}
                    </span>
                  </div>
                  
                  <!-- Список должностей в группе -->
                  <div v-if="group.expanded" class="border-t border-gray-200 bg-gray-50">
                    <div class="p-2 space-y-1">
                      <label
                        v-for="position in group.positions"
                        :key="position"
                        class="flex items-center gap-3 p-2 pl-10 hover:bg-white rounded cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          :checked="selectedPositions.includes(position)"
                          @change="togglePosition(position)"
                          class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span class="text-sm text-gray-700">{{ position }}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="selectedPositions.length > 0" class="mt-3 flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700">Выбрано должностей:</span>
                <span class="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                  {{ selectedPositions.length }}
                </span>
              </div>
              <p class="mt-3 text-xs text-gray-600">
                Экспорт включает: участников, вебинары, чаты, вопросы и ответы на опросы
              </p>
            </div>

            <!-- Экспорт по ИНН -->
            <div v-if="exportType === 'inn'" class="space-y-4">
              <div>
                <label class="block text-lg font-medium text-gray-900 mb-3">
                  Загрузите файл с ИНН
                </label>
                <p class="text-sm text-gray-600 mb-4">
                  Поддерживаемые форматы: .txt, .xlsx<br>
                  ИНН должны быть записаны в столбик (каждый ИНН на новой строке или в отдельной ячейке)
                </p>
                
                <!-- Drag & Drop зона -->
                <div
                  @dragover="handleDragOver"
                  @dragleave="handleDragLeave"
                  @drop="handleDrop"
                  @click="triggerFileInput"
                  :class="[
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : innFile
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                  ]"
                >
                  <input
                    ref="innFileInput"
                    type="file"
                    accept=".txt,.xlsx"
                    @change="handleInnFileChange"
                    class="hidden"
                  />
                  
                  <div v-if="!innFile" class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div>
                      <p class="text-base font-medium text-gray-700">
                        Перетащите файл сюда или <span class="text-blue-600">выберите файл</span>
                      </p>
                      <p class="text-sm text-gray-500 mt-1">
                        .txt или .xlsx
                      </p>
                    </div>
                  </div>
                  
                  <div v-else class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p class="text-base font-medium text-gray-700">
                        {{ innFile.name }}
                      </p>
                      <p class="text-sm text-gray-500 mt-1">
                        {{ (innFile.size / 1024).toFixed(2) }} КБ
                      </p>
                      <button
                        @click.stop="innFile = null"
                        class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Удалить файл
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Кнопка экспорта -->
            <div class="flex justify-end pt-4">
              <button
                @click="handleExport"
                :disabled="isExporting || (exportType === 'tags' && selectedTags.length === 0) || (exportType === 'positions' && selectedPositions.length === 0) || (exportType === 'inn' && !innFile)"
                class="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isExporting ? 'Экспорт...' : 'Экспортировать' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
