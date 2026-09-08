<script setup lang="ts">
defineProps<{ title: string; intro?: string; auth?: boolean }>()
const { t } = useLanguage()
const { logout } = useCustomer()
const busy = ref(false)
const error = ref('')
async function signOut() {
  busy.value = true
  try {
    await logout()
  } catch (cause) {
    error.value = customerError(cause)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <main id="main" class="account-page light-surface">
    <div class="account-heading">
      <p class="eyebrow">{{ t('YOUR KHT', 'حسابك في KHT') }}</p>
      <h1>{{ title }}</h1>
      <p v-if="intro" class="muted">{{ intro }}</p>
    </div>
    <div :class="['account-layout', { 'account-auth': auth }]">
      <aside v-if="!auth" class="account-sidebar">
        <nav :aria-label="t('Your account', 'حسابك')">
          <NuxtLink to="/account" exact-active-class="account-active">{{
            t('Profile & security', 'الملف الشخصي والأمان')
          }}</NuxtLink
          ><NuxtLink to="/account/addresses" active-class="account-active">{{
            t('Address book', 'دفتر العناوين')
          }}</NuxtLink
          ><NuxtLink to="/account/orders" active-class="account-active">{{
            t('Orders & tracking', 'الطلبات والتتبع')
          }}</NuxtLink
          ><NuxtLink to="/shop">{{ t('Continue shopping', 'متابعة التسوق') }}</NuxtLink>
        </nav>
        <button class="account-text-button" :disabled="busy" @click="signOut">
          {{ busy ? t('Signing out…', 'جاري الخروج…') : t('Sign out', 'تسجيل الخروج') }}
        </button>
        <p v-if="error" role="alert">{{ error }}</p>
      </aside>
      <div class="account-content"><slot /></div>
    </div>
  </main>
</template>
