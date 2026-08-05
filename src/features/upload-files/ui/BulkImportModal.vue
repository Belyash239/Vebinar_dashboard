<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  close: []
  success: []
}>()

interface ColumnMapping {
  excelColumn: string
  dbField: string
}

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const excelColumns = ref<string[]>([])
const rowCount = ref(0)
const columnMappings = ref<ColumnMapping[]>([])
const isLoadingColumns = ref(false)
const isUploading = ref(false)
const uploadError = ref('')
const currentStep = ref<'upload' | 'mapping'>('upload')

// Доступные поля БД для маппинга (все поля из основного листа)
const dbFields = [
  // ИНН ПОЛЯ - САМЫЕ ВАЖНЫЕ, РАЗМЕЩАЕМ В НАЧАЛЕ
  { value: 'ИНН_компании', label: '🔑 ИНН компании (основное поле)' },
  { value: 'ИНН', label: '🔑 ИНН (если нет "ИНН компании")' },
  
  // Основные поля участника
  { value: 'Email', label: 'Email' },
  { value: 'Имя', label: 'Имя' },
  { value: 'Фамилия', label: 'Фамилия' },
  { value: 'Название_компании', label: 'Название компании' },
  { value: 'Телефон', label: 'Телефон' },
  { value: 'Должность', label: 'Должность' },
  
  // Поля вебинара
  { value: 'Вебинар', label: 'Вебинар (название)' },
  { value: 'Дата_проведения', label: 'Дата проведения' },
  { value: 'Теги', label: 'Теги (через запятую)' },
  
  // Поля участия в вебинаре
  { value: 'Имя_в_чате', label: 'Имя в чате' },
  { value: 'Компания_чат', label: 'Компания (из чата)' },
  { value: 'Статус_регистрации', label: 'Статус регистрации' },
  { value: 'Дата_регистрации', label: 'Дата регистрации' },
  { value: 'Источники', label: 'Источники' },
  { value: 'utm_source', label: 'utm_source' },
  { value: 'utm_medium', label: 'utm_medium' },
  { value: 'utm_campaign', label: 'utm_campaign' },
  { value: 'utm_content', label: 'utm_content' },
  { value: 'Платформа', label: 'Платформа' },
  { value: 'Страна', label: 'Страна' },
  { value: 'Город', label: 'Город' },
  { value: 'Последний_IP', label: 'Последний IP' },
  { value: 'Время_входа_первое', label: 'Время входа (первое)' },
  { value: 'Время_выхода_последнее', label: 'Время выхода (последнее)' },
  { value: 'Присутствие_относительно_длительности', label: 'Присутствие относительно длительности (мин)' },
  { value: 'Присутствие_от_общей_длительности', label: 'Присутствие от общей длительности (%)' },
  { value: 'Кол_во_сообщений', label: 'Количество сообщений' },
  { value: 'Процент_от_общего_кол_ва_сообщений', label: 'Процент от общего кол-ва сообщений (%)' },
  { value: 'Кол_во_вопросов', label: 'Количество вопросов' },
  { value: 'Процент_от_общего_кол_ва_вопросов', label: 'Процент от общего кол-ва вопросов (%)' },
  { value: 'Количество_поднятых_рук', label: 'Количество поднятых рук' },
  { value: 'Количество_отправленных_эмодзи_реакций', label: 'Количество отправленных эмодзи-реакций' },
  
  { value: '', label: '— Не импортировать —' }
]

// Отладка - проверяем, что поля ИНН есть
console.log('🔍 BulkImportModal загружен!')
console.log('🔍 dbFields содержит', dbFields.length, 'полей')
console.log('🔍 Первые 5 полей:', dbFields.slice(0, 5))
console.log('🔍 Поля с ИНН:', dbFields.filter(f => f.value.includes('ИНН')))

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const selectedFile = target.files?.[0]
  
  if (!selectedFile) return
  
  file.value = selectedFile
  uploadError.value = ''
  
  // Загружаем файл для чтения колонок
  await loadExcelColumns()
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const selectedFile = files[0]
    const extension = selectedFile.name.split('.').pop()?.toLowerCase()
    
    if (extension === 'xlsx' || extension === 'xls') {
      file.value = selectedFile
      uploadError.value = ''
      await loadExcelColumns()
    } else {
      alert('Пожалуйста, загрузите файл формата .xlsx или .xls')
    }
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const loadExcelColumns = async () => {
  if (!file.value) return
  
  isLoadingColumns.value = true
  uploadError.value = ''
  
  try {
    const formData = new FormData()
    formData.append('file', file.value)
    
    const response = await fetch('http://localhost:3000/api/bulk-import/columns', {
      method: 'POST',
      body: formData
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to read columns')
    }
    
    excelColumns.value = result.columns
    rowCount.value = result.rowCount || 0
    
    console.log('📋 Колонки из Excel файла:')
    console.log('  Всего колонок:', excelColumns.value.length)
    console.log('  Список:', excelColumns.value)
    
    // Инициализируем маппинги с автоматическим сопоставлением
    columnMappings.value = excelColumns.value.map(col => ({
      excelColumn: col,
      dbField: autoMapColumn(col) // Автоматически подбираем соответствие
    }))
    
    // Считаем сколько полей было замаплено автоматически
    const autoMappedCount = columnMappings.value.filter(m => m.dbField !== '').length
    console.log(`✅ Автоматически замаплено ${autoMappedCount} из ${excelColumns.value.length} колонок`)
    
    currentStep.value = 'mapping'
  } catch (error) {
    console.error('Error loading columns:', error)
    uploadError.value = error instanceof Error 
      ? `Ошибка: ${error.message}` 
      : 'Не удалось прочитать колонки файла'
  } finally {
    isLoadingColumns.value = false
  }
}

// Автоматическое сопоставление колонок по названию
const autoMapColumn = (excelColumn: string): string => {
  const col = excelColumn.toLowerCase().trim()
  
  console.log(`🔍 Мапинг колонки: "${excelColumn}" (нормализовано: "${col}")`)
  
  // Email
  if (col === 'email' || col === 'e-mail' || col === 'почта') {
    console.log('  ✅ → Email')
    return 'Email'
  }
  
  // Имя
  if (col === 'имя' || col === 'name' || col === 'first name' || col === 'firstname') {
    console.log('  ✅ → Имя')
    return 'Имя'
  }
  
  // Фамилия
  if (col === 'фамилия' || col === 'surname' || col === 'last name' || col === 'lastname') {
    console.log('  ✅ → Фамилия')
    return 'Фамилия'
  }
  
  // ИНН компании - сначала проверяем более специфичные варианты
  if (col === 'инн компании' || col === 'инн_компании' || col.includes('инн') && col.includes('компани')) {
    console.log('  ✅ → ИНН_компании')
    return 'ИНН_компании'
  }
  
  // ИНН (простой) - только если нет слова "компани"
  if (col === 'инн' || (col.includes('инн') && !col.includes('компани'))) {
    console.log('  ✅ → ИНН')
    return 'ИНН'
  }
  
  // Компания / Название компании
  if (col === 'компания' || col === 'название компании' || col === 'название_компании' || 
      col === 'company' || col === 'company name' || col === 'organization') {
    console.log('  ✅ → Название_компании')
    return 'Название_компании'
  }
  
  // Телефон
  if (col === 'телефон' || col === 'номер телефона' || col === 'мобильный телефон' || 
      col === 'phone' || col === 'mobile' || col === 'telephone') {
    console.log('  ✅ → Телефон')
    return 'Телефон'
  }
  
  // Должность
  if (col === 'должность' || col === 'position' || col === 'role' || col === 'job title') {
    console.log('  ✅ → Должность')
    return 'Должность'
  }
  
  // Вебинар
  if (col === 'вебинар' || col === 'webinar' || col === 'название вебинара' || col === 'webinar name') {
    console.log('  ✅ → Вебинар')
    return 'Вебинар'
  }
  
  // Дата проведения
  if (col === 'дата проведения' || col === 'дата' || col === 'date' || col === 'webinar date' || col === 'дата вебинара') {
    console.log('  ✅ → Дата_проведения')
    return 'Дата_проведения'
  }
  
  // Теги
  if (col === 'теги' || col === 'тег' || col === 'tags' || col === 'tag' || col === 'категории' || col === 'категория') {
    console.log('  ✅ → Теги')
    return 'Теги'
  }
  
  // Имя в чате
  if (col === 'имя в чате' || col === 'chat name' || col === 'display name') {
    console.log('  ✅ → Имя_в_чате')
    return 'Имя_в_чате'
  }
  
  // Компания из чата
  if (col === 'компания чат' || col === 'компания (чат)' || col === 'chat company') {
    console.log('  ✅ → Компания_чат')
    return 'Компания_чат'
  }
  
  // Статус регистрации
  if (col === 'статус регистрации' || col === 'registration status' || col === 'статус') {
    console.log('  ✅ → Статус_регистрации')
    return 'Статус_регистрации'
  }
  
  // Дата регистрации
  if (col === 'дата регистрации' || col === 'registration date' || col === 'зарегистрирован') {
    console.log('  ✅ → Дата_регистрации')
    return 'Дата_регистрации'
  }
  
  // Источники
  if (col === 'источники' || col === 'source' || col === 'sources') {
    console.log('  ✅ → Источники')
    return 'Источники'
  }
  
  // UTM метки
  if (col === 'utm_source' || col === 'utm source' || col === 'utmsource') {
    console.log('  ✅ → utm_source')
    return 'utm_source'
  }
  if (col === 'utm_medium' || col === 'utm medium' || col === 'utmmedium') {
    console.log('  ✅ → utm_medium')
    return 'utm_medium'
  }
  if (col === 'utm_campaign' || col === 'utm campaign' || col === 'utmcampaign') {
    console.log('  ✅ → utm_campaign')
    return 'utm_campaign'
  }
  if (col === 'utm_content' || col === 'utm content' || col === 'utmcontent') {
    console.log('  ✅ → utm_content')
    return 'utm_content'
  }
  
  // Платформа
  if (col === 'платформа' || col === 'platform') {
    console.log('  ✅ → Платформа')
    return 'Платформа'
  }
  
  // Страна
  if (col === 'страна' || col === 'country') {
    console.log('  ✅ → Страна')
    return 'Страна'
  }
  
  // Город
  if (col === 'город' || col === 'city') {
    console.log('  ✅ → Город')
    return 'Город'
  }
  
  // IP
  if (col === 'последний ip' || col === 'ip' || col === 'last ip' || col === 'ip address') {
    console.log('  ✅ → Последний_IP')
    return 'Последний_IP'
  }
  
  // Время входа
  if (col === 'время входа (первое)' || col === 'время входа' || col === 'первый вход' || 
      col === 'first entry' || col === 'entry time') {
    console.log('  ✅ → Время_входа_первое')
    return 'Время_входа_первое'
  }
  
  // Время выхода
  if (col === 'время выхода (последнее)' || col === 'время выхода' || col === 'последний выход' ||
      col === 'last exit' || col === 'exit time') {
    console.log('  ✅ → Время_выхода_последнее')
    return 'Время_выхода_последнее'
  }
  
  // Присутствие (минуты)
  if (col.includes('присутствие') && (col.includes('длительност') || col.includes('мин'))) {
    console.log('  ✅ → Присутствие_относительно_длительности')
    return 'Присутствие_относительно_длительности'
  }
  
  // Присутствие (проценты)
  if (col.includes('присутствие') && (col.includes('%') || col.includes('процент') || col.includes('общей'))) {
    console.log('  ✅ → Присутствие_от_общей_длительности')
    return 'Присутствие_от_общей_длительности'
  }
  
  // Количество сообщений
  if ((col.includes('кол') || col.includes('количество')) && col.includes('сообщен')) {
    console.log('  ✅ → Кол_во_сообщений')
    return 'Кол_во_сообщений'
  }
  
  // Процент сообщений
  if (col.includes('процент') && col.includes('сообщен')) {
    console.log('  ✅ → Процент_от_общего_кол_ва_сообщений')
    return 'Процент_от_общего_кол_ва_сообщений'
  }
  
  // Количество вопросов
  if ((col.includes('кол') || col.includes('количество')) && col.includes('вопрос')) {
    console.log('  ✅ → Кол_во_вопросов')
    return 'Кол_во_вопросов'
  }
  
  // Процент вопросов
  if (col.includes('процент') && col.includes('вопрос')) {
    console.log('  ✅ → Процент_от_общего_кол_ва_вопросов')
    return 'Процент_от_общего_кол_ва_вопросов'
  }
  
  // Поднятые руки
  if (col.includes('подня') && col.includes('рук')) {
    console.log('  ✅ → Количество_поднятых_рук')
    return 'Количество_поднятых_рук'
  }
  
  // Эмодзи реакции
  if (col.includes('эмодзи') || col.includes('реакц')) {
    console.log('  ✅ → Количество_отправленных_эмодзи_реакций')
    return 'Количество_отправленных_эмодзи_реакций'
  }
  
  console.log('  ⚠️ → Не найдено соответствие, не импортируется')
  return ''
}

const handleBack = () => {
  currentStep.value = 'upload'
  file.value = null
  excelColumns.value = []
  rowCount.value = 0
  columnMappings.value = []
  uploadError.value = ''
}

const handleSubmit = async () => {
  if (!file.value) {
    uploadError.value = 'Необходимо загрузить файл'
    return
  }
  
  // Проверяем, что хотя бы одно поле выбрано
  const hasMapping = columnMappings.value.some(m => m.dbField !== '')
  if (!hasMapping) {
    uploadError.value = 'Необходимо выбрать хотя бы одно поле для импорта'
    return
  }
  
  isUploading.value = true
  uploadError.value = ''
  
  try {
    const formData = new FormData()
    formData.append('file', file.value)
    formData.append('mappings', JSON.stringify(columnMappings.value))
    
    const response = await fetch('http://localhost:3000/api/bulk-import', {
      method: 'POST',
      body: formData
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Import failed')
    }
    
    emit('close')
    emit('success')
  } catch (error) {
    console.error('Import error:', error)
    uploadError.value = error instanceof Error 
      ? `Ошибка: ${error.message}` 
      : 'Ошибка при импорте файла. Попробуйте снова.'
  } finally {
    isUploading.value = false
  }
}

const mappedFieldsCount = computed(() => {
  return columnMappings.value.filter(m => m.dbField !== '').length
})
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-8">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="text-3xl font-semibold text-gray-900">Импорт больших файлов</h2>
            <p class="text-sm text-gray-500 mt-2">
              Шаг {{ currentStep === 'upload' ? '1' : '2' }} из 2: 
              {{ currentStep === 'upload' ? 'Загрузка файла' : 'Настройка соответствия полей' }}
            </p>
          </div>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <!-- Шаг 1: Загрузка файла -->
        <div v-if="currentStep === 'upload'" class="space-y-6">
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Выберите Excel файл для импорта
            </label>
            <div
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
              @click="triggerFileInput"
              :class="[
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition',
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              ]"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect"
                :disabled="isLoadingColumns"
                class="hidden"
              />
              
              <div v-if="!file && !isLoadingColumns" class="flex flex-col items-center gap-3">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <p class="text-base font-medium text-gray-700">
                    Перетащите файл сюда или <span class="text-blue-600">выберите файл</span>
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    .xlsx или .xls
                  </p>
                </div>
              </div>
              
              <div v-else-if="isLoadingColumns" class="flex flex-col items-center gap-3">
                <svg class="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-base font-medium text-blue-600">
                  Чтение файла...
                </p>
              </div>
              
              <div v-else class="flex flex-col items-center gap-3">
                <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-base font-medium text-gray-700">
                    {{ file.name }}
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ (file.size / 1024).toFixed(2) }} КБ
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm text-blue-800">
                <p class="font-medium mb-1">О больших файлах:</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>Файл может содержать данные о множестве вебинаров одновременно</li>
                  <li>Система автоматически группирует участников по вебинарам</li>
                  <li>После загрузки вы настроите соответствие полей</li>
                  <li>Можно пропустить отдельные колонки</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Шаг 2: Маппинг полей -->
        <div v-if="currentStep === 'mapping'" class="space-y-6">
          <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm font-medium text-gray-900">Файл: {{ file?.name }}</span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-600">
                <span>Строк: {{ rowCount }}</span>
                <span>Колонок: {{ excelColumns.length }}</span>
              </div>
            </div>
            <div class="text-sm text-blue-600">
              Настроено соответствий: {{ mappedFieldsCount }} из {{ excelColumns.length }}
            </div>
          </div>

          <div v-if="mappedFieldsCount > 0" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="text-sm text-yellow-800">
                <p class="font-medium mb-1">Важно:</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>Система автоматически создаст вебинары для каждой уникальной комбинации "название + дата"</li>
                  <li>Участники будут корректно распределены по вебинарам</li>
                  <li>Дубликаты участников обрабатываются автоматически</li>
                  <li>Процесс может занять несколько минут для {{ rowCount }} строк</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Настройка соответствия полей</h3>
            <p class="text-sm text-gray-600 mb-4">
              Укажите, какому полю базы данных соответствует каждая колонка из Excel файла
            </p>
            
            <div class="space-y-3 max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg p-4">
              <div
                v-for="(mapping, index) in columnMappings"
                :key="index"
                class="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200"
              >
                <div class="flex-shrink-0 w-8 text-center">
                  <span class="text-xs font-medium text-gray-500">{{ index + 1 }}</span>
                </div>
                
                <div class="flex-1 min-w-0">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Колонка Excel
                  </label>
                  <div class="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border border-gray-300 truncate" :title="mapping.excelColumn">
                    {{ mapping.excelColumn }}
                  </div>
                </div>
                
                <div class="flex items-center justify-center text-gray-400 flex-shrink-0">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                
                <div class="flex-1 min-w-0">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Поле БД
                  </label>
                  <select
                    v-model="mapping.dbField"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option v-for="field in dbFields" :key="field.value" :value="field.value">
                      {{ field.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click="handleBack"
              :disabled="isUploading"
              class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <button
              @click="handleSubmit"
              :disabled="isUploading || mappedFieldsCount === 0"
              class="flex-1 px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg v-if="isUploading" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isUploading ? 'Импорт данных...' : 'Импортировать' }}</span>
            </button>
          </div>
        </div>

        <!-- Ошибка -->
        <div v-if="uploadError" class="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
          {{ uploadError }}
        </div>
      </div>
    </div>
  </div>
</template>
