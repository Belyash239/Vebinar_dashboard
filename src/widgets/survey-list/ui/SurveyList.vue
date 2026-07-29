<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Survey {
  id: number
  questionsCount: number
  participantsCount: number
  webinarName: string | null
  webinarId: number | null
}

const surveys = ref<Survey[]>([])
const isLoading = ref(false)
const deletingId = ref<number | null>(null)

const fetchSurveys = async () => {
  isLoading.value = true
  try {
    const response = await fetch('http://localhost:3000/api/surveys')
    const data = await response.json()
    surveys.value = data
  } catch (error) {
    console.error('Error fetching surveys:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchSurveys()
})

const deleteSurvey = async (id: number) => {
  if (!confirm(`Вы уверены, что хотите удалить опрос #${id}?\n\nЭто действие удалит все связанные данные (вопросы и ответы).`)) {
    return
  }

  deletingId.value = id
  try {
    const response = await fetch(`http://localhost:3000/api/surveys/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete survey')
    }

    // Обновляем список
    await fetchSurveys()
  } catch (error) {
    console.error('Error deleting survey:', error)
    alert('Ошибка при удалении опроса')
  } finally {
    deletingId.value = null
  }
}

defineExpose({
  fetchSurveys
})
</script>

<template>
  <div class="bg-white rounded-lg shadow">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-medium text-gray-900">Список импортированных опросов</h2>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr class="bg-gray-50">
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID опроса
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Привязанный вебинар
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Вопросов
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Участников
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="isLoading">
              <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                Загрузка...
              </td>
            </tr>
            <tr v-else-if="surveys.length === 0">
              <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                Нет импортированных опросов
              </td>
            </tr>
            <tr v-else v-for="survey in surveys" :key="survey.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                #{{ survey.id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <router-link 
                  v-if="survey.webinarId && survey.webinarName"
                  :to="`/webinar/${survey.webinarId}`"
                  class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  {{ survey.webinarName }}
                </router-link>
                <span v-else class="text-gray-500">Не привязан</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ survey.questionsCount }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ survey.participantsCount }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button
                  @click="deleteSurvey(survey.id)"
                  :disabled="deletingId === survey.id"
                  class="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Удалить опрос"
                >
                  <svg v-if="deletingId === survey.id" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
