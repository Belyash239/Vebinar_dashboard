<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface DaDataConfig {
  enabled: boolean
  intervalHours: number
  batchSize: number
  prioritizeLatestWebinar: boolean
  dailyLimit: number
}

interface DaDataState {
  lastRun: string | null
  todayCount: number
  lastResetDate: string
}

const emit = defineEmits<{
  close: []
}>()

const config = ref<DaDataConfig>({
  enabled: true,
  intervalHours: 12,
  batchSize: 200,
  prioritizeLatestWebinar: true,
  dailyLimit: 1000
})

const state = ref<DaDataState>({
  lastRun: null,
  todayCount: 0,
  lastResetDate: ''
})

const isSaving = ref(false)
const isForceRunning = ref(false)

const fetchConfig = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/dadata/config')
    const data = await response.json()
    config.value = data.config
    state.value = data.state
  } catch (error) {
    console.error('Error fetching DaData config:', error)
  }
}

const saveConfig = async () => {
  isSaving.value = true
  try {
    const response = await fetch('http://localhost:3000/api/dadata/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.value)
    })
    
    if (response.ok) {
      alert('Настройки сохранены успешно')
      await fetchConfig()
    } else {
      throw new Error('Failed to save config')
    }
  } catch (error) {
    console.error('Error saving config:', error)
    alert('Ошибка при сохранении настроек')
  } finally {
    isSaving.value = false
  }
}

const forceRun = async () => {
  if (!confirm('Запустить обогащение данных принудительно?')) return
  
  isForceRunning.value = true
  try {
    const response = await fetch('http://localhost:3000/api/dadata/force-run', {
      method: 'POST'
    })
    
    const result = await response.json()
    
    if (result.success) {
      alert(`Обогащено ${result.updated} из ${result.total} компаний\nИспользовано сегодня: ${result.todayCount}/${result.dailyLimit}`)
      await fetchConfig()
    } else {
      alert('Обогащение не выполнено')
    }
  } catch (error) {
    console.error('Error forcing DaData run:', error)
    alert('Ошибка при запуске обогащения')
  } finally {
    isForceRunning.value = false
  }
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Никогда'
  const date = new Date(dateStr)
  return date.toLocaleString('ru-RU')
}

onMounted(() => {
  fetchConfig()
})
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-semibold text-gray-900">Настройки DaData</h2>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <!-- Статус -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-medium text-blue-900 mb-2">Статус автообогащения</h3>
          <div class="text-sm text-blue-800 space-y-1">
            <div>Последний запуск: {{ formatDate(state.lastRun) }}</div>
            <div>Использовано сегодня: {{ state.todayCount }} / {{ config.dailyLimit }}</div>
          </div>
        </div>

        <!-- Основные настройки -->
        <div class="space-y-4">
          <div class="flex items-center">
            <input
              v-model="config.enabled"
              type="checkbox"
              id="enabled"
              class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label for="enabled" class="ml-2 text-sm font-medium text-gray-900">
              Включить автоматическое обогащение
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Интервал обновления (часы)
            </label>
            <input
              v-model.number="config.intervalHours"
              type="number"
              min="1"
              max="168"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">Как часто запускать автообогащение (от 1 до 168 часов)</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Размер пакета (компаний за раз)
            </label>
            <input
              v-model.number="config.batchSize"
              type="number"
              min="1"
              max="1000"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">Сколько компаний обрабатывать за один запуск</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Дневной лимит запросов
            </label>
            <input
              v-model.number="config.dailyLimit"
              type="number"
              min="1"
              max="10000"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">Максимальное количество запросов к DaData в день</p>
          </div>

          <div class="flex items-center">
            <input
              v-model="config.prioritizeLatestWebinar"
              type="checkbox"
              id="prioritize"
              class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label for="prioritize" class="ml-2 text-sm font-medium text-gray-900">
              Приоритет для компаний из последнего вебинара
            </label>
          </div>
        </div>

        <!-- Действия -->
        <div class="flex gap-3 pt-4 border-t border-gray-200">
          <button
            @click="saveConfig"
            :disabled="isSaving"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSaving ? 'Сохранение...' : 'Сохранить настройки' }}
          </button>
          
          <button
            @click="forceRun"
            :disabled="isForceRunning"
            class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isForceRunning ? 'Запуск...' : 'Запустить сейчас' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
