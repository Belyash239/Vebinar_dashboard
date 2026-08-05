<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const emit = defineEmits<{
  close: []
  success: []
}>()

interface Webinar {
  id: number
  name: string
  date: string
}

const surveyFile = ref<File | null>(null)
const surveyFileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const webinars = ref<Webinar[]>([])
const selectedWebinar = ref<number | null>(null)
const webinarSearchQuery = ref('')
const importPositions = ref(false)
const isLoadingWebinars = ref(false)
const isUploading = ref(false)
const uploadError = ref('')

const filteredWebinars = computed(() => {
  if (!webinarSearchQuery.value.trim()) {
    return webinars.value
  }
  
  const query = webinarSearchQuery.value.toLowerCase()
  return webinars.value.filter(w => 
    w.name.toLowerCase().includes(query)
  )
})

// Загрузить вебинары с сервера
const loadWebinars = async () => {
  isLoadingWebinars.value = true
  try {
    const response = await fetch('http://localhost:3000/api/webinars')
    const webinarsData = await response.json()
    webinars.value = webinarsData.map((webinar: any) => ({
      id: webinar.id,
      name: webinar.name,
      date: webinar.date
    }))
  } catch (error) {
    console.error('Error loading webinars:', error)
    uploadError.value = 'Не удалось загрузить список вебинаров'
  } finally {
    isLoadingWebinars.value = false
  }
}

onMounted(() => {
  loadWebinars()
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    surveyFile.value = file
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
    
    if (extension === 'xlsx' || extension === 'xls') {
      surveyFile.value = file
    } else {
      alert('Пожалуйста, загрузите файл формата .xlsx или .xls')
    }
  }
}

const triggerFileInput = () => {
  surveyFileInput.value?.click()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
}

const clearWebinarSelection = () => {
  selectedWebinar.value = null
  webinarSearchQuery.value = ''
}

const handleSubmit = async () => {
  if (!surveyFile.value) {
    uploadError.value = 'Необходимо загрузить файл с опросами'
    return
  }

  isUploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('surveyFile', surveyFile.value)
    formData.append('webinarId', selectedWebinar.value ? selectedWebinar.value.toString() : '')
    formData.append('importPositions', importPositions.value.toString())

    const response = await fetch('http://localhost:3000/api/upload-survey', {
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
      : 'Ошибка при загрузке файла. Попробуйте снова.'
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-8">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-3xl font-semibold text-gray-900">Импорт опросов</h2>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Файл с опросами -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Файл с опросами
            </label>
            <div
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
              @click="triggerFileInput"
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : surveyFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              ]"
            >
              <input
                ref="surveyFileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect"
                class="hidden"
              />
              
              <div v-if="!surveyFile" class="flex flex-col items-center gap-3">
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
              
              <div v-else class="flex flex-col items-center gap-3">
                <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-base font-medium text-gray-700">
                    {{ surveyFile.name }}
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ (surveyFile.size / 1024).toFixed(2) }} КБ
                  </p>
                  <button
                    @click.stop="surveyFile = null"
                    class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Удалить файл
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Выбор вебинара (опционально) -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="block text-lg font-medium text-gray-900">
                Привязать к вебинару (опционально)
              </label>
              <button
                v-if="selectedWebinar"
                @click="clearWebinarSelection"
                type="button"
                class="text-sm text-red-600 hover:text-red-800"
              >
                Очистить выбор
              </button>
            </div>
            
            <div v-if="isLoadingWebinars" class="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
              Загрузка вебинаров...
            </div>
            
            <div v-else class="bg-gray-50 rounded-lg p-4">
              <!-- Поиск вебинара -->
              <div class="relative mb-3">
                <input
                  v-model="webinarSearchQuery"
                  type="text"
                  placeholder="Поиск вебинара..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <!-- Выбранный вебинар -->
              <div v-if="selectedWebinar" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium text-blue-900">Выбранный вебинар:</div>
                    <div class="text-sm text-blue-700">
                      {{ webinars.find(w => w.id === selectedWebinar)?.name }}
                    </div>
                  </div>
                  <button
                    @click="clearWebinarSelection"
                    type="button"
                    class="text-blue-600 hover:text-blue-800"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Список вебинаров -->
              <div class="max-h-60 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                <div v-if="filteredWebinars.length === 0" class="p-4 text-sm text-gray-500 text-center">
                  {{ webinarSearchQuery ? 'Вебинары не найдены' : 'Нет доступных вебинаров' }}
                </div>
                <button
                  v-else
                  v-for="webinar in filteredWebinars"
                  :key="webinar.id"
                  type="button"
                  @click="selectedWebinar = webinar.id"
                  class="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition"
                  :class="{ 'bg-blue-50': selectedWebinar === webinar.id }"
                >
                  <div class="text-sm text-gray-900">{{ webinar.name }}</div>
                  <div class="text-xs text-gray-500">{{ formatDate(webinar.date) }}</div>
                </button>
              </div>
              
              <p class="mt-2 text-xs text-gray-500">
                Если вебинар не выбран, опросы будут импортированы без привязки к вебинару
              </p>
            </div>
          </div>

          <!-- Импорт должностей -->
          <div>
            <label class="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
              <input
                v-model="importPositions"
                type="checkbox"
                class="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span class="text-lg font-medium text-gray-900">Импортировать должности</span>
                <p class="text-sm text-gray-600 mt-1">
                  Будут импортированы должности участников из соответствующих колонок опроса
                </p>
              </div>
            </label>
          </div>

          <!-- Ошибка -->
          <div v-if="uploadError" class="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
            {{ uploadError }}
          </div>

          <!-- Кнопка загрузить -->
          <div class="flex justify-end pt-4">
            <button
              type="submit"
              :disabled="isUploading"
              class="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isUploading ? 'Загрузка...' : 'Загрузить' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
