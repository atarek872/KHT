<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template>
  <div class="error-page">
    <a href="/" class="wordmark">KHT</a><span class="long-line" />
    <p>{{ error.statusCode }}</p>
    <h1>{{ error.statusCode === 404 ? 'OFF THE LINE.' : 'A SMALL INTERRUPTION.' }}</h1>
    <p>
      {{
        error.statusCode === 404
          ? 'This page is not part of the collection.'
          : 'We couldn’t load this page. Please try again.'
      }}
    </p>
    <button class="button button-white" @click="clearError({ redirect: '/' })">
      Back to KHT →
    </button>
  </div>
</template>
