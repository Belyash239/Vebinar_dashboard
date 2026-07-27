import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/home/ui/HomePage.vue'
import DashboardPage from '@/pages/dashboard/ui/DashboardPage.vue'
import WebinarDetailPage from '@/pages/webinar-detail/ui/WebinarDetailPage.vue'
import ParticipantDetailPage from '@/pages/participant-detail/ui/ParticipantDetailPage.vue'
import CompanyDetailPage from '@/pages/company-detail/ui/CompanyDetailPage.vue'

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
  },
  {
    path: '/webinar/:id',
    name: 'webinar-detail',
    component: WebinarDetailPage
  },
  {
    path: '/participant/:email',
    name: 'participant-detail',
    component: ParticipantDetailPage
  },
  {
    path: '/company/:inn',
    name: 'company-detail',
    component: CompanyDetailPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
