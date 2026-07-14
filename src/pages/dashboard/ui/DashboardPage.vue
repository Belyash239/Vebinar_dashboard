<script setup lang="ts">
import { ref } from 'vue'
import WebinarList from '@/widgets/webinar-list/ui/WebinarList.vue'
import ImportModal from '@/features/upload-files/ui/ImportModal.vue'

const showImportModal = ref(false)
const webinarListRef = ref<InstanceType<typeof WebinarList> | null>(null)

const openImportModal = () => {
  showImportModal.value = true
}

const closeImportModal = () => {
  showImportModal.value = false
}

const handleImportSuccess = () => {
  webinarListRef.value?.fetchWebinars()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 class="text-2xl font-semibold text-gray-900">Управление импортом</h1>
        <router-link 
          to="/"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          На главную
        </router-link>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <WebinarList 
        ref="webinarListRef"
        @open-import="openImportModal" 
      />
    </main>

    <ImportModal 
      v-if="showImportModal" 
      @close="closeImportModal"
      @success="handleImportSuccess"
    />
  </div>
</template>
