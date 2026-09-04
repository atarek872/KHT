<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en', dir: 'ltr' },
  bodyAttrs: { class: 'kht-admin-auth-body' },
})
</script>

<template>
  <div class="kht-admin admin-auth-layout">
    <a class="admin-auth-skip-link" href="#admin-login">Skip to login</a>
    <slot />
  </div>
</template>