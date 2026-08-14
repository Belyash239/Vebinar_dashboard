<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const emit = defineEmits<{
  close: []
  success: []
}>()

interface Tag {
  id: number
  name: string
  checked: boolean
}

interface FieldMapping {
  dbField: string
  description: string
  possibleNames: string[]
  category: 'participant' | 'webinar' | 'chat' | 'question' | 'survey' | 'attendance'
}

interface FileAnalysis {
  file: File
  columns: string[]
  rowCount: number
  detectedFormat: 'mts' | 'proofix' | 'unknown'
  fileType: 'main' | 'questions' | 'chat' | 'survey' | 'attendance' | 'unknown'
  mapping: Record<string, string>
}

const uploadedFiles = ref<FileAnalysis[]>([])
const importPositions = ref(false)
const isDragging = ref(false)
const showMappingModal = ref(false)
const currentMappingFileIndex = ref<number | null>(null)

const webinarName = ref('')
const webinarDate = ref('')
const detectedSystemFormat = ref<'mts' | 'proofix' | null>(null)

const tags = ref<Tag[]>([])
const isLoadingTags = ref(false)
const isUploading = ref(false)
const isAnalyzing = ref(false)
const uploadError = ref('')
const selectedTagsCount = ref(0)

// Загружаем маппинги полей с сервера
const UNIQUE_FIELDS_POOL = ref<FieldMapping[]>([])
const isLoadingFields = ref(false)

const loadFieldMappings = async () => {
  isLoadingFields.value = true
  try {
    const response = await fetch('http://localhost:3000/api/field-mappings')
    const data = await response.json()
    UNIQUE_FIELDS_POOL.value = data.fields
  } catch (error) {
    console.error('Error loading field mappings:', error)
  } finally {
    isLoadingFields.value = false
  }
}

// Загрузить теги с сервера
const loadTags = async () => {
  isLoadingTags.value = true
  try {
    const response = await fetch('http://localhost:3000/api/tags')
    const tagsData = await response.json()
    tags.value = tagsData.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      checked: false
    }))
  } catch (error) {
    console.error('Error loading tags:', error)
    uploadError.value = 'Не удалось загрузить список тегов'
  } finally {
    isLoadingTags.value = false
  }
}

const updateSelectedCount = () => {
  selectedTagsCount.value = tags.value.filter(t => t.checked).length
}

const toggleAllTags = () => {
  const allSelected = tags.value.every(t => t.checked)
  tags.value.forEach(tag => {
    tag.checked = !allSelected
  })
  updateSelectedCount()
}

onMounted(() => {
  loadTags()
  loadFieldMappings()
})

// Определение формата по колонкам
const detectFormat = (columns: string[]): 'mts' | 'proofix' => {
  // МТС-линк имеет специфичные длинные названия колонок
  const mtsIndicators = [
    'Присутствие относительно длительности',
    'Процент от общего кол-ва',
    'Количество поднятых рук'
  ]
  
  const hasMtsColumns = mtsIndicators.some(indicator => 
    columns.some(col => col.includes(indicator))
  )
  
  if (hasMtsColumns) return 'mts'
  
  // Proofix имеет специфичные поля
  const proofixIndicators = ['Utm метки', 'ID_сообщения', 'Код участника']
  const hasProofixColumns = proofixIndicators.some(indicator => columns.includes(indicator))
  
  if (hasProofixColumns) return 'proofix'
  
  // По умолчанию по количеству колонок
  return columns.length > 15 ? 'mts' : 'proofix'
}

// Определение типа файла
const detectFileType = (columns: string[]): 'main' | 'questions' | 'chat' | 'survey' | 'attendance' | 'unknown' => {
  // МТС-линк: основной лист
  const mtsMainIndicators = [
    'Присутствие относительно длительности мероприятия',
    'Статус регистрации',
    'Количество поднятых рук',
    'Платформа'
  ]
  if (mtsMainIndicators.some(ind => columns.some(col => col.includes(ind)))) {
    return 'main'
  }
  
  // МТС-линк: вопросы
  const mtsQuestionsIndicators = [
    'Почта автора вопроса',
    'Статус вопроса',
    'Ответы и комментарии'
  ]
  if (mtsQuestionsIndicators.some(ind => columns.includes(ind))) {
    return 'questions'
  }
  
  // Чат
  const chatIndicators = [
    'Сообщение чата',
    'ID_сообщения',
    'Кол-во лайков сообщения',
    'email участника мероприятия'
  ]
  if (chatIndicators.some(ind => columns.some(col => col.includes(ind)))) {
    return 'chat'
  }
  
  // Proofix: присутствие
  const attendanceIndicators = [
    'Продолжительность присутствия участника,   минут',
    'Кол-во подтверждений Контроля присутствия'
  ]
  if (attendanceIndicators.some(ind => columns.some(col => col.includes(ind)))) {
    return 'attendance'
  }
  
  // Опросы - проверяем ПЕРЕД регистрациями
  const surveyIndicators = [
    'Участник', // МТС-линк
    'Последний вход' // Proofix
  ]
  
  const hasEmail = columns.some(col => col.toLowerCase() === 'email' || col.toLowerCase() === 'e-mail')
  const hasSurveyMarkers = surveyIndicators.some(ind => columns.includes(ind))
  const hasMainMarkers = mtsMainIndicators.some(ind => columns.some(col => col.includes(ind)))
  
  if (hasEmail && hasSurveyMarkers && !hasMainMarkers) {
    return 'survey'
  }
  
  // Proofix: регистрации
  if (columns.includes('Utm метки') && columns.length < 15 && !hasMainMarkers) {
    return 'main'
  }
  
  // По умолчанию - основной если есть Email
  if (hasEmail && columns.length > 5) {
    return 'main'
  }
  
  return 'unknown'
}

// Автоматический маппинг колонок
const autoMapColumns = (columns: string[], format: 'mts' | 'proofix'): Record<string, string> => {
  const mapping: Record<string, string> = {}
  
  for (const field of UNIQUE_FIELDS_POOL.value) {
    for (const possibleName of field.possibleNames) {
      if (columns.includes(possibleName)) {
        mapping[field.dbField] = possibleName
        break
      }
    }
  }
  
  return mapping
}

// Извлечение названия и даты вебинара из файлов
const extractWebinarInfo = async (file: File): Promise<{ name: string | null, date: string | null }> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('http://localhost:3000/api/extract-webinar-info', {
      method: 'POST',
      body: formData
    })
    
    if (response.ok) {
      const data = await response.json()
      return { name: data.webinarName, date: data.webinarDate }
    }
  } catch (error) {
    console.error('Error extracting webinar info:', error)
  }
  
  return { name: null, date: null }
}

// Анализ файлов
const analyzeFiles = async (files: FileList) => {
  isAnalyzing.value = true
  uploadError.value = ''
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const extension = file.name.split('.').pop()?.toLowerCase()
      
      if (extension !== 'xlsx' && extension !== 'xls') {
        uploadError.value = 'Пожалуйста, загрузите файлы формата .xlsx или .xls'
        continue
      }
      
      // Отправляем файл на анализ
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('http://localhost:3000/api/analyze-file', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Failed to analyze file')
      }
      
      const analysis = await response.json()
      const format = detectFormat(analysis.columns)
      const fileType = detectFileType(analysis.columns)
      const mapping = autoMapColumns(analysis.columns, format)
      
      uploadedFiles.value.push({
        file,
        columns: analysis.columns,
        rowCount: analysis.rowCount,
        detectedFormat: format,
        fileType: fileType,
        mapping
      })
    }
    
    // ПОСЛЕ загрузки ВСЕХ файлов определяем систему
    if (uploadedFiles.value.length > 0) {
      // Приоритет: если есть хотя бы один основной файл МТС-линк, то вся система МТС-линк
      const hasMtsMainFile = uploadedFiles.value.some(f => 
        f.detectedFormat === 'mts' && f.fileType === 'main'
      )
      
      if (hasMtsMainFile) {
        detectedSystemFormat.value = 'mts'
        console.log('📊 Обнаружен основной файл МТС-линк → система: МТС-линк')
      } else {
        // Иначе определяем по большинству файлов
        const formatCounts = uploadedFiles.value.reduce((acc, f) => {
          acc[f.detectedFormat] = (acc[f.detectedFormat] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const dominantFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0][0] as 'mts' | 'proofix'
        detectedSystemFormat.value = dominantFormat
        
        console.log('📊 Определена система по большинству файлов:', dominantFormat, formatCounts)
      }
      
      // Пытаемся извлечь название и дату из файлов МТС-линк
      if (detectedSystemFormat.value === 'mts' && !webinarName.value) {
        const mainFile = uploadedFiles.value.find(f => f.fileType === 'main')
        if (mainFile) {
          const info = await extractWebinarInfo(mainFile.file)
          if (info.name) webinarName.value = info.name
          if (info.date) webinarDate.value = info.date
        }
      }
    }
  } catch (error) {
    console.error('Error analyzing files:', error)
    uploadError.value = 'Ошибка при анализе файлов'
  } finally {
    isAnalyzing.value = false
  }
}

const handleFiles = async (files: FileList) => {
  await analyzeFiles(files)
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
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
  
  if (event.dataTransfer?.files) {
    handleFiles(event.dataTransfer.files)
  }
}

const removeFile = (index: number) => {
  uploadedFiles.value.splice(index, 1)
  if (uploadedFiles.value.length === 0) {
    detectedSystemFormat.value = null
  }
}

const getFormatLabel = (format: string): string => {
  const labels: Record<string, string> = {
    mts: 'МТС-линк',
    proofix: 'Proofix',
    unknown: 'Неизвестный'
  }
  return labels[format] || format
}

const getFileTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    main: 'Участники',
    questions: 'Вопросы',
    chat: 'Чат',
    survey: 'Опросы',
    attendance: 'Присутствие',
    unknown: 'Неизвестный'
  }
  return labels[type] || type
}

const openMappingModal = (index: number) => {
  currentMappingFileIndex.value = index
  showMappingModal.value = true
}

const closeMappingModal = () => {
  showMappingModal.value = false
  currentMappingFileIndex.value = null
}

const currentFile = computed(() => {
  if (currentMappingFileIndex.value !== null) {
    return uploadedFiles.value[currentMappingFileIndex.value]
  }
  return null
})

const availableDbFields = computed(() => {
  if (!currentFile.value) return []
  
  // Возвращаем ВСЕ поля из пула
  return UNIQUE_FIELDS_POOL.value
})

const groupedFields = computed(() => {
  const groups: Record<string, FieldMapping[]> = {
    participant: [],
    webinar: [],
    attendance: [],
    chat: [],
    question: [],
    survey: []
  }
  
  for (const field of UNIQUE_FIELDS_POOL.value) {
    if (groups[field.category]) {
      groups[field.category].push(field)
    }
  }
  
  return groups
})

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    participant: 'Компания / Участники / Email',
    webinar: 'Вебинары / Теги',
    attendance: 'Участники-Вебинары',
    chat: 'Чат',
    question: 'Вопросы',
    survey: 'Опросы'
  }
  return labels[category] || category
}

const updateMapping = (dbField: string, excelColumn: string) => {
  if (currentMappingFileIndex.value !== null) {
    uploadedFiles.value[currentMappingFileIndex.value].mapping[dbField] = excelColumn
  }
}

// Получить поле БД для колонки Excel (обратный поиск)
const getDbFieldForColumn = (column: string): string => {
  if (currentMappingFileIndex.value === null) return ''
  
  const mapping = uploadedFiles.value[currentMappingFileIndex.value].mapping
  
  // Ищем dbField, которому соответствует эта колонка
  for (const [dbField, mappedColumn] of Object.entries(mapping)) {
    if (mappedColumn === column) {
      return dbField
    }
  }
  
  return ''
}

// Обновить маппинг по колонке (обратная логика)
const updateMappingByColumn = (column: string, dbField: string) => {
  if (currentMappingFileIndex.value === null) return
  
  const mapping = uploadedFiles.value[currentMappingFileIndex.value].mapping
  
  // Удаляем старый маппинг этой колонки (если был)
  for (const [oldDbField, mappedColumn] of Object.entries(mapping)) {
    if (mappedColumn === column) {
      delete mapping[oldDbField]
    }
  }
  
  // Добавляем новый маппинг
  if (dbField) {
    mapping[dbField] = column
  }
}

const handleSubmit = async () => {
  if (uploadedFiles.value.length === 0) {
    uploadError.value = 'Необходимо загрузить хотя бы один файл'
    return
  }

  if (!webinarName.value.trim()) {
    uploadError.value = 'Необходимо указать название вебинара'
    return
  }
  
  if (!webinarDate.value) {
    uploadError.value = 'Необходимо указать дату вебинара'
    return
  }

  isUploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    
    formData.append('webinarName', webinarName.value.trim())
    formData.append('webinarDate', webinarDate.value)
    formData.append('importPositions', importPositions.value.toString())
    
    // Добавляем файлы и их маппинги
    uploadedFiles.value.forEach((fileAnalysis, index) => {
      formData.append(`files`, fileAnalysis.file)
      formData.append(`mappings`, JSON.stringify(fileAnalysis.mapping))
      formData.append(`formats`, fileAnalysis.detectedFormat)
    })

    const selectedTags = tags.value.filter(t => t.checked).map(t => t.name)
    formData.append('tags', JSON.stringify(selectedTags))

    const response = await fetch('http://localhost:3000/api/upload-with-mapping', {
      method: 'POST',
      body: formData
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.details || result.error || 'Upload failed')
    }

    emit('close')
    emit('success')
  } catch (error) {
    console.error('Upload error:', error)
    uploadError.value = error instanceof Error 
      ? `Ошибка: ${error.message}` 
      : 'Ошибка при загрузке файлов. Попробуйте снова.'
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-8">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-3xl font-semibold text-gray-900">Загрузите файлы вебинара</h2>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Единое поле загрузки файлов -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Загрузите файлы
            </label>
            <div
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
              @click="() => ($refs.fileInput as any)?.click()"
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              ]"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".xlsx,.xls"
                multiple
                @change="handleFileSelect"
                class="hidden"
              />
              
              <div class="flex flex-col items-center gap-3">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <p class="text-base font-medium text-gray-700">
                    Перетащите файлы сюда или <span class="text-blue-600">выберите файлы</span>
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    .xlsx или .xls (все файлы вебинара)
                  </p>
                  <p class="text-xs text-gray-400 mt-2">
                    Система автоматически определит формат и создаст маппинг колонок
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Индикатор анализа -->
          <div v-if="isAnalyzing" class="text-center text-gray-600 py-4">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2">Анализ файлов...</p>
          </div>

          <!-- Список загруженных файлов -->
          <div v-if="uploadedFiles.length > 0" class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-700">Загруженные файлы ({{ uploadedFiles.length }})</h3>
              <div v-if="detectedSystemFormat" class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                Система: {{ getFormatLabel(detectedSystemFormat) }}
              </div>
            </div>
            <div class="space-y-2">
              <div
                v-for="(item, index) in uploadedFiles"
                :key="index"
                class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div class="flex items-center gap-3 flex-1">
                  <svg class="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 break-words">{{ item.file.name }}</p>
                    <p class="text-xs text-gray-500">
                      {{ (item.file.size / 1024).toFixed(2) }} КБ • 
                      {{ item.rowCount }} строк • 
                      {{ item.columns.length }} колонок
                      <span class="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        {{ getFileTypeLabel(item.fileType) }}
                      </span>
                    </p>
                    <p class="text-xs text-gray-400 mt-1">
                      Замаплено полей: {{ Object.keys(item.mapping).length }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click.stop="openMappingModal(index)"
                    class="text-gray-600 hover:text-gray-800"
                    title="Настроить маппинг"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    @click.stop="removeFile(index)"
                    class="text-red-600 hover:text-red-800"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Информация о вебинаре -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                Название вебинара <span class="text-red-500">*</span>
              </label>
              <input
                v-model="webinarName"
                type="text"
                placeholder="Введите название вебинара"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                Дата вебинара <span class="text-red-500">*</span>
              </label>
              <input
                v-model="webinarDate"
                type="date"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p class="text-xs text-gray-600">
              Для файлов МТС-линк поля заполняются автоматически, но можно изменить
            </p>
          </div>

          <!-- Галочка импорта должностей -->
          <div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="importPositions"
                type="checkbox"
                class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Импортировать должности из опросов</span>
            </label>
            <p class="mt-2 text-xs text-gray-500 ml-7">
              Должности будут определяться по ключевым словам в вопросах и ответах
            </p>
          </div>

          <!-- Теги -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Теги
            </label>
            <div v-if="isLoadingTags" class="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
              Загрузка тегов...
            </div>
            <div v-else class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                <span class="text-sm text-gray-600">Выберите теги</span>
                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-600">Выбрано: {{ selectedTagsCount }}</span>
                  <button
                    type="button"
                    @click="toggleAllTags"
                    class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {{ tags.every(t => t.checked) ? 'Снять всё' : 'Выбрать всё' }}
                  </button>
                </div>
              </div>
              <div class="max-h-60 overflow-y-auto space-y-2">
                <label
                  v-for="tag in tags"
                  :key="tag.id"
                  class="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"
                >
                  <input
                    v-model="tag.checked"
                    type="checkbox"
                    class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    @change="updateSelectedCount"
                  />
                  <span class="text-sm text-gray-700">{{ tag.name }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Ошибка -->
          <div v-if="uploadError" class="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
            {{ uploadError }}
          </div>

          <!-- Кнопка загрузить -->
          <div class="flex justify-end pt-4">
            <button
              type="submit"
              :disabled="isUploading || uploadedFiles.length === 0"
              class="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isUploading ? 'Загрузка...' : 'Загрузить' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Модальное окно маппинга -->
    <div v-if="showMappingModal && currentFile" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="p-6 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h3 class="text-2xl font-semibold text-gray-900">Настройка маппинга</h3>
            <button
              @click="closeMappingModal"
              class="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <p class="text-sm text-gray-600 mt-2">
            Файл: {{ currentFile.file.name }} • 
            Формат: {{ getFormatLabel(currentFile.detectedFormat) }}
          </p>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <div class="mb-4 bg-blue-50 p-3 rounded-lg text-sm text-gray-700">
            <p><strong>Колонок в файле:</strong> {{ currentFile.columns.length }}</p>
            <p><strong>Замаплено:</strong> {{ Object.keys(currentFile.mapping).length }} полей</p>
            <p class="text-xs text-gray-600 mt-2">Укажите какому полю БД соответствует каждая колонка из файла</p>
          </div>

          <!-- Таблица: Колонка Excel → Поле БД -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-100 sticky top-0">
                <tr>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700">Колонка в Excel</th>
                  <th class="px-4 py-2 text-center text-gray-400">→</th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700">Поле БД</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(column, index) in currentFile.columns" :key="index" 
                    class="border-b border-gray-200 hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">{{ column }}</div>
                  </td>
                  <td class="px-4 py-3 text-center text-gray-400">→</td>
                  <td class="px-4 py-3">
                    <select
                      :value="getDbFieldForColumn(column)"
                      @change="(e) => updateMappingByColumn(column, (e.target as HTMLSelectElement).value)"
                      class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Не использовать</option>
                      <optgroup v-for="(fields, category) in groupedFields" :key="category" :label="getCategoryLabel(category)">
                        <option v-for="field in fields" :key="field.dbField" :value="field.dbField">
                          {{ field.dbField }}
                        </option>
                      </optgroup>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="p-6 border-t border-gray-200 flex justify-end">
          <button
            @click="closeMappingModal"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
