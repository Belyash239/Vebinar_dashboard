<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Stats {
  totalWebinars: number
  avgParticipants: number
  avgConversion: number
  avgRetention: number
  totalUsers: number
  popularProduct: string
}

interface Participant {
  name: string
  inn: string
  email: string
  webinarCount: number
  messagesCount: number
  questionsCount: number
}

interface Message {
  chatName: string
  email: string
  time: string
  message: string
  webinarName: string
}

interface Question {
  author: string
  question: string
  status: string
  responder: string
  webinarName: string
}

const stats = ref<Stats>({
  totalWebinars: 0,
  avgParticipants: 0,
  avgConversion: 0,
  avgRetention: 0,
  totalUsers: 0,
  popularProduct: 'Нет данных'
})

const participants = ref<Participant[]>([])
const messages = ref<Message[]>([])
const questions = ref<Question[]>([])
const isLoading = ref(false)

const fetchStats = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/stats')
    stats.value = await response.json()
  } catch (error) {
    console.error('Error fetching stats:', error)
  }
}

const fetchParticipants = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/participants')
    participants.value = await response.json()
  } catch (error) {
    console.error('Error fetching participants:', error)
  }
}

const fetchMessages = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/messages')
    messages.value = await response.json()
  } catch (error) {
    console.error('Error fetching messages:', error)
  }
}

const fetchQuestions = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/questions')
    questions.value = await response.json()
  } catch (error) {
    console.error('Error fetching questions:', error)
  }
}

const loadData = async () => {
  isLoading.value = true
  await Promise.all([
    fetchStats(),
    fetchParticipants(),
    fetchMessages(),
    fetchQuestions()
  ])
  isLoading.value = false
}

onMounted(() => {
  loadData()
})
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
          Импорт данных
        </router-link>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div v-if="isLoading" class="text-center py-12">
        <div class="text-gray-500">Загрузка данных...</div>
      </div>

      <div v-else>
        <!-- Карточки метрик -->
        <section class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <!-- Всего вебинаров -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Всего вебинаров</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalWebinars }}</div>
            </div>

            <!-- Среднее кол-во участников -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Среднее кол-во участников</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgParticipants }}</div>
            </div>

            <!-- Средняя конверсия -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Средняя конверсия</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgConversion }}%</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Среднее удержание -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Среднее удержание</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.avgRetention }}%</div>
            </div>

            <!-- Всего уникальных пользователей -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Всего уникальных пользователей</div>
              <div class="text-4xl font-bold text-gray-900">{{ stats.totalUsers }}</div>
            </div>

            <!-- Наиболее популярный продукт -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="text-sm text-gray-600 mb-2">Наиболее популярный продукт</div>
              <div class="text-2xl font-bold text-gray-900 mt-3">{{ stats.popularProduct }}</div>
            </div>
          </div>
        </section>

        <!-- Таблица участников -->
        <section class="mb-8">
          <h2 class="text-xl font-semibold mb-4 text-gray-900">Участники</h2>
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div v-if="participants.length === 0" class="p-8 text-center text-gray-500">
              Нет данных об участниках. Импортируйте файлы вебинаров.
            </div>
            <table v-else class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ИНН</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кол-во вебинаров</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сообщений</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Вопросов</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(participant, index) in participants" :key="index" class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">{{ participant.name }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ participant.inn }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ participant.email }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ participant.webinarCount }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ participant.messagesCount }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ participant.questionsCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Сообщения чата -->
        <section class="mb-8">
          <h2 class="text-xl font-semibold mb-4 text-gray-900">Последние сообщения чата</h2>
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div v-if="messages.length === 0" class="p-8 text-center text-gray-500">
              Нет сообщений в чате.
            </div>
            <div v-else class="divide-y divide-gray-200">
              <div 
                v-for="(msg, index) in messages.slice(0, 10)" 
                :key="index"
                class="p-4 hover:bg-gray-50"
              >
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <span class="font-medium text-gray-900">{{ msg.chatName }}</span>
                    <span class="text-sm text-gray-500 ml-2">({{ msg.email }})</span>
                  </div>
                  <span class="text-xs text-gray-400">{{ msg.time }}</span>
                </div>
                <div class="text-sm text-gray-700">{{ msg.message }}</div>
                <div class="text-xs text-gray-400 mt-1">Вебинар: {{ msg.webinarName }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Вопросы -->
        <section>
          <h2 class="text-xl font-semibold mb-4 text-gray-900">Вопросы участников</h2>
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div v-if="questions.length === 0" class="p-8 text-center text-gray-500">
              Нет вопросов.
            </div>
            <table v-else class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Автор</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Вопрос</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Отвечающий</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Вебинар</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(q, index) in questions.slice(0, 10)" :key="index" class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">{{ q.author }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ q.question }}</td>
                  <td class="px-6 py-4 text-sm">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {{ q.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ q.responder }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ q.webinarName }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
