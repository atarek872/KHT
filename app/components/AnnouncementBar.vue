<script setup lang="ts">
const props = defineProps<{
  messages: string[]
  durationSeconds: number
  language: 'en' | 'ar'
}>()

const motionStyle = computed(() => ({
  '--announcement-duration': `${props.durationSeconds}s`,
}))
</script>

<template>
  <div class="announcement" :style="motionStyle">
    <span class="sr-only">{{ messages.join(' · ') }}</span>
    <div class="announcement-track" aria-hidden="true">
      <div
        v-for="copy in 10"
        :key="copy"
        class="announcement-set"
        :dir="language === 'ar' ? 'rtl' : 'ltr'"
      >
        <span v-for="(message, index) in messages" :key="index" class="announcement-item">
          {{ message }}
        </span>
      </div>
    </div>
  </div>
</template>
