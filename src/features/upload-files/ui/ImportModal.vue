<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  close: []
  success: []
}>()

interface Tag {
  id: number
  name: string
  checked: boolean
}

const mainFile = ref<File | null>(null)
const questionsFile = ref<File | null>(null)
const chatFile = ref<File | null>(null)
const surveyFile = ref<File | null>(null)
const importPositions = ref(false)

const mainFileInput = ref<HTMLInputElement | null>(null)
const questionsFileInput = ref<HTMLInputElement | null>(null)
const chatFileInput = ref<HTMLInputElement | null>(null)
const surveyFileInput = ref<HTMLInputElement | null>(null)

const isDraggingMain = ref(false)
const isDraggingQuestions = ref(false)
const isDraggingChat = ref(false)
const isDraggingSurvey = ref(false)

const tags = ref<Tag[]>([])
const isLoadingTags = ref(false)
const isUploading = ref(false)
const uploadError = ref('')
const selectedTagsCount = ref(0)

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
})

const handleFileSelect = (event: Event, fileType: 'main' | 'questions' | 'chat' | 'survey') => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    if (fileType === 'main') mainFile.value = file
    else if (fileType === 'questions') questionsFile.value = file
    else if (fileType === 'chat') chatFile.value = file
    else if (fileType === 'survey') surveyFile.value = file
  }
}

const handleDragOver = (event: DragEvent, fileType: 'main' | 'questions' | 'chat' | 'survey') => {
  event.preventDefault()
  if (fileType === 'main') isDraggingMain.value = true
  else if (fileType === 'questions') isDraggingQuestions.value = true
  else if (fileType === 'chat') isDraggingChat.value = true
  else if (fileType === 'survey') isDraggingSurvey.value = true
}

const handleDragLeave = (event: DragEvent, fileType: 'main' | 'questions' | 'chat' | 'survey') => {
  event.preventDefault()
  if (fileType === 'main') isDraggingMain.value = false
  else if (fileType === 'questions') isDraggingQuestions.value = false
  else if (fileType === 'chat') isDraggingChat.value = false
  else if (fileType === 'survey') isDraggingSurvey.value = false
}

const handleDrop = (event: DragEvent, fileType: 'main' | 'questions' | 'chat' | 'survey') => {
  event.preventDefault()
  
  if (fileType === 'main') isDraggingMain.value = false
  else if (fileType === 'questions') isDraggingQuestions.value = false
  else if (fileType === 'chat') isDraggingChat.value = false
  else if (fileType === 'survey') isDraggingSurvey.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension === 'xlsx' || extension === 'xls') {
      if (fileType === 'main') mainFile.value = file
      else if (fileType === 'questions') questionsFile.value = file
      else if (fileType === 'chat') chatFile.value = file
      else if (fileType === 'survey') surveyFile.value = file
    } else {
      alert('Пожалуйста, загрузите файл формата .xlsx или .xls')
    }
  }
}

const triggerFileInput = (fileType: 'main' | 'questions' | 'chat' | 'survey') => {
  if (fileType === 'main') mainFileInput.value?.click()
  else if (fileType === 'questions') questionsFileInput.value?.click()
  else if (fileType === 'chat') chatFileInput.value?.click()
  else if (fileType === 'survey') surveyFileInput.value?.click()
}

const removeFile = (fileType: 'main' | 'questions' | 'chat' | 'survey') => {
  if (fileType === 'main') mainFile.value = null
  else if (fileType === 'questions') questionsFile.value = null
  else if (fileType === 'chat') chatFile.value = null
  else if (fileType === 'survey') {
    surveyFile.value = null
    importPositions.value = false
  }
}

const handleSubmit = async () => {
  if (!mainFile.value) {
    uploadError.value = 'Необходимо загрузить основной файл'
    return
  }

  isUploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('mainFile', mainFile.value)
    
    if (questionsFile.value) {
      formData.append('questionsFile', questionsFile.value)
    }
    
    if (chatFile.value) {
      formData.append('chatFile', chatFile.value)
    }
    
    if (surveyFile.value) {
      formData.append('surveyFile', surveyFile.value)
      formData.append('importPositions', importPositions.value.toString())
    }

    const selectedTags = tags.value.filter(t => t.checked).map(t => t.name)
    formData.append('tags', JSON.stringify(selectedTags))

    const response = await fetch('http://localhost:3000/api/upload', {
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
          <h2 class="text-3xl font-semibold text-gray-900">Загрузите файлы</h2>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Основной лист -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Основной лист
            </label>
            <div
              @dragover="handleDragOver($event, 'main')"
              @dragleave="handleDragLeave($event, 'main')"
              @drop="handleDrop($event, 'main')"
              @click="triggerFileInput('main')"
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                isDraggingMain
                  ? 'border-blue-500 bg-blue-50'
                  : mainFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              ]"
            >
              <input
                ref="mainFileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect($event, 'main')"
                class="hidden"
              />
              
              <div v-if="!mainFile" class="flex flex-col items-center gap-3">
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
                    {{ mainFile.name }}
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ (mainFile.size / 1024).toFixed(2) }} КБ
                  </p>
                  <button
                    @click.stop="removeFile('main')"
                    class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Удалить файл
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Вопросы -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Вопросы
            </label>
            <div
              @dragover="handleDragOver($event, 'questions')"
              @dragleave="handleDragLeave($event, 'questions')"
              @drop="handleDrop($event, 'questions')"
              @click="triggerFileInput('questions')"
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                isDraggingQuestions
                  ? 'border-blue-500 bg-blue-50'
                  : questionsFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              ]"
            >
              <input
                ref="questionsFileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect($event, 'questions')"
                class="hidden"
              />
              
              <div v-if="!questionsFile" class="flex flex-col items-center gap-3">
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
                    {{ questionsFile.name }}
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ (questionsFile.size / 1024).toFixed(2) }} КБ
                  </p>
                  <button
                    @click.stop="removeFile('questions')"
                    class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Удалить файл
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Чат -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Чат
            </label>
            <div
              @dragover="handleDragOver($event, 'chat')"
              @dragleave="handleDragLeave($event, 'chat')"
              @drop="handleDrop($event, 'chat')"
              @click="triggerFileInput('chat')"
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                isDraggingChat
                  ? 'border-blue-500 bg-blue-50'
                  : chatFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              ]"
            >
              <input
                ref="chatFileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect($event, 'chat')"
                class="hidden"
              />
              
              <div v-if="!chatFile" class="flex flex-col items-center gap-3">
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
                    {{ chatFile.name }}
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ (chatFile.size / 1024).toFixed(2) }} КБ
                  </p>
                  <button
                    @click.stop="removeFile('chat')"
                    class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Удалить файл
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Опросы (необязательно) -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Опросы <span class="text-sm text-gray-500 font-normal">(необязательно)</span>
            </label>
            <div
              @dragover="handleDragOver($event, 'survey')"
              @dragleave="handleDragLeave($event, 'survey')"
              @drop="handleDrop($event, 'survey')"
              @click="triggerFileInput('survey')"
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition',
                isDraggingSurvey
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
                @change="handleFileSelect($event, 'survey')"
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
                    @click.stop="removeFile('survey')"
                    class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Удалить файл
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Галочка импорта должностей -->
            <div v-if="surveyFile" class="mt-4">
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
