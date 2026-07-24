<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const emit = defineEmits<{
  openImport: []
  openExport: []
  refresh: []
}>()

interface Webinar {
  id: number
  name: string
  tags: string | null
  date: string
}

interface TagOption {
  name: string
  checked: boolean
}

const webinars = ref<Webinar[]>([])
const allWebinars = ref<Webinar[]>([])
const searchQuery = ref('')
const isLoading = ref(false)
const deletingId = ref<number | null>(null)
const tagOptions = ref<TagOption[]>([])
const showFilters = ref(false)

const selectedTagsCount = computed(() => tagOptions.value.filter(t => t.checked).length)

const fetchWebinars = async () => {
  isLoading.value = true
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
    
    // Применяем фильтры
    applyFilters()
  } catch (error) {
    console.error('Error fetching webinars:', error)
  } finally {
    isLoading.value = false
  }
}

const applyFilters = () => {
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

const toggleTag = (tag: TagOption) => {
  tag.checked = !tag.checked
  applyFilters()
}

const clearFilters = () => {
  searchQuery.value = ''
  tagOptions.value.forEach(tag => tag.checked = false)
  applyFilters()
}

onMounted(() => {
  fetchWebinars()
})

const deleteWebinar = async (id: number, name: string) => {
  if (!confirm(`Вы уверены, что хотите удалить вебинар "${name}"?\n\nЭто действие удалит все связанные данные (участников, чат, вопросы).`)) {
    return
  }

  deletingId.value = id
  try {
    const response = await fetch(`http://localhost:3000/api/webinars/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete webinar')
    }

    // Обновляем список
    await fetchWebinars()
  } catch (error) {
    console.error('Error deleting webinar:', error)
    alert('Ошибка при удалении вебинара')
  } finally {
    deletingId.value = null
  }
}

defineExpose({
  fetchWebinars
})
</script>

<template>
  <div class="bg-white rounded-lg shadow">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-medium text-gray-900">Список импортированных вебинаров</h2>
        
        <div class="flex items-center gap-4">
          <button
            @click="emit('openExport')"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            title="Экспорт данных"
          >
            Экспорт данных
          </button>

          <button
            @click="emit('openImport')"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
            title="Добавить вебинар"
          >
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button
            @click="showFilters = !showFilters"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Фильтры
            <span v-if="selectedTagsCount > 0" class="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
              {{ selectedTagsCount }}
            </span>
          </button>

          <div class="relative">
            <input
              v-model="searchQuery"
              @input="applyFilters"
              type="text"
              placeholder="Поиск по названию..."
              class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Панель фильтров -->
      <div v-if="showFilters" class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-900">Фильтрация</h3>
          <button
            v-if="selectedTagsCount > 0 || searchQuery"
            @click="clearFilters"
            class="text-sm text-blue-600 hover:text-blue-800"
          >
            Сбросить все
          </button>
        </div>
        
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Теги
              <span v-if="selectedTagsCount > 0" class="ml-2 text-xs text-blue-600">
                (выбрано: {{ selectedTagsCount }})
              </span>
            </label>
            <div class="max-h-60 overflow-y-auto border border-gray-300 rounded-lg bg-white">
              <div v-if="tagOptions.length === 0" class="p-4 text-sm text-gray-500 text-center">
                Нет доступных тегов
              </div>
              <label 
                v-else
                v-for="tag in tagOptions" 
                :key="tag.name"
                class="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  :checked="tag.checked"
                  @change="toggleTag(tag)"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="ml-3 text-sm text-gray-700">{{ tag.name }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr class="bg-gray-50">
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название
                <span v-if="webinars.length !== allWebinars.length" class="ml-2 text-blue-600 font-normal normal-case">
                  ({{ webinars.length }} из {{ allWebinars.length }})
                </span>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Теги
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="isLoading">
              <td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
                Загрузка...
              </td>
            </tr>
            <tr v-else-if="webinars.length === 0 && (searchQuery || selectedTagsCount > 0)">
              <td colspan="4" class="px-6 py-8 text-center">
                <div class="text-sm text-gray-500 mb-2">
                  Нет вебинаров, соответствующих выбранным фильтрам
                </div>
                <button
                  @click="clearFilters"
                  class="text-sm text-blue-600 hover:text-blue-800"
                >
                  Сбросить фильтры
                </button>
              </td>
            </tr>
            <tr v-else-if="webinars.length === 0">
              <td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
                Нет импортированных вебинаров. Нажмите "+" чтобы добавить.
              </td>
            </tr>
            <tr v-else v-for="webinar in webinars" :key="webinar.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ webinar.date }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button
                  @click="deleteWebinar(webinar.id, webinar.name)"
                  :disabled="deletingId === webinar.id"
                  class="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Удалить вебинар"
                >
                  <svg v-if="deletingId === webinar.id" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
