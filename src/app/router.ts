import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/home/ui/HomePage.vue'
import DashboardPage from '@/pages/dashboard/ui/DashboardPage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage
  },
  {
    path: '/import',
    name: 'import',
    component: DashboardPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
