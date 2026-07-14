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

const webinarName = ref('')
const mainFile = ref<File | null>(null)
const questionsFile = ref<File | null>(null)
const chatFile = ref<File | null>(null)

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

onMounted(() => {
  loadTags()
})

const handleFileSelect = (event: Event, fileType: 'main' | 'questions' | 'chat') => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    if (fileType === 'main') mainFile.value = file
    else if (fileType === 'questions') questionsFile.value = file
    else if (fileType === 'chat') chatFile.value = file
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
    formData.append('webinarName', webinarName.value)
    formData.append('mainFile', mainFile.value)
    
    if (questionsFile.value) {
      formData.append('questionsFile', questionsFile.value)
    }
    
    if (chatFile.value) {
      formData.append('chatFile', chatFile.value)
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
          <!-- Название вебинара -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Название вебинара
            </label>
            <input
              v-model="webinarName"
              type="text"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Основной лист -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Основной лист
            </label>
            <div class="relative border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition">
              <input
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect($event, 'main')"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div class="text-center text-gray-500">
                <span v-if="!mainFile">Перетащите файл или нажмите для выбора</span>
                <span v-else class="text-blue-600">{{ mainFile.name }}</span>
              </div>
            </div>
          </div>

          <!-- Вопросы -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Вопросы
            </label>
            <div class="relative border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition">
              <input
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect($event, 'questions')"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div class="text-center text-gray-500">
                <span v-if="!questionsFile">Перетащите файл или нажмите для выбора</span>
                <span v-else class="text-blue-600">{{ questionsFile.name }}</span>
              </div>
            </div>
          </div>

          <!-- Чат -->
          <div>
            <label class="block text-lg font-medium text-gray-900 mb-3">
              Чат
            </label>
            <div class="relative border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition">
              <input
                type="file"
                accept=".xlsx,.xls"
                @change="handleFileSelect($event, 'chat')"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div class="text-center text-gray-500">
                <span v-if="!chatFile">Перетащите файл или нажмите для выбора</span>
                <span v-else class="text-blue-600">{{ chatFile.name }}</span>
              </div>
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
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-600">Выбрано: {{ selectedTagsCount }}</span>
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
