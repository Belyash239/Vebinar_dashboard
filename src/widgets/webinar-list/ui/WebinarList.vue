<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  openImport: []
  refresh: []
}>()

interface Webinar {
  id: number
  name: string
  tags: string | null
  date: string
}

const webinars = ref<Webinar[]>([])
const searchQuery = ref('')
const isLoading = ref(false)

const fetchWebinars = async () => {
  isLoading.value = true
  try {
    const response = await fetch('http://localhost:3000/api/webinars')
    const data = await response.json()
    webinars.value = data
  } catch (error) {
    console.error('Error fetching webinars:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchWebinars()
})

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
            @click="emit('openImport')"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
            title="Добавить вебинар"
          >
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
          </button>

          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск"
              class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr class="bg-gray-50">
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Теги
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="isLoading">
              <td colspan="3" class="px-6 py-8 text-center text-sm text-gray-500">
                Загрузка...
              </td>
            </tr>
            <tr v-else-if="webinars.length === 0">
              <td colspan="3" class="px-6 py-8 text-center text-sm text-gray-500">
                Нет импортированных вебинаров. Нажмите "+" чтобы добавить.
              </td>
            </tr>
            <tr v-else v-for="webinar in webinars" :key="webinar.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ webinar.name }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">
                {{ webinar.tags || '—' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ webinar.date }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
