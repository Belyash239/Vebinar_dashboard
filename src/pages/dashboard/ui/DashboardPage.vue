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

const handleExport = async () => {
  if (selectedTags.value.length === 0) {
    alert('Выберите хотя бы один тег')
    return
  }

  isExporting.value = true

  try {
    // Экспорт по тегам
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
}
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
            <h2 class="text-3xl font-semibold text-gray-900">Экспорт чатов и вопросов</h2>
            <button
              @click="closeExportModal"
              class="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div class="space-y-6">
            <!-- Выбор тегов -->
            <div>
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

            <!-- Кнопка экспорта -->
            <div class="flex justify-end pt-4">
              <button
                @click="handleExport"
                :disabled="isExporting || selectedTags.length === 0"
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
