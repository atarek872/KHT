<script setup lang="ts">
definePageMeta({ layout: 'admin-auth' })
useSeoMeta({ title: 'Admin Access — KHT', robots: 'noindex, nofollow' })

const route = useRoute()
const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const busy = ref(false)
const error = ref(
  route.query.reason === 'unauthorized'
    ? 'Your admin session is unavailable or expired. Sign in to continue.'
    : '',
)

function safeRedirect() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  const isAdminRoute = redirect === '/admin' || redirect.startsWith('/admin/')
  return isAdminRoute && !redirect.startsWith('/admin/login') ? redirect : '/admin'
}

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''

  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    await navigateTo(safeRedirect())
  } catch (cause: unknown) {
    const failure = cause as { status?: number; statusCode?: number; data?: { statusCode?: number } }
    const status = failure.status || failure.statusCode || failure.data?.statusCode
    error.value =
      status === 401
        ? 'Email or password is incorrect. Check your details and try again.'
        : 'Admin access is unavailable. Try again later.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main id="admin-login" class="admin-login">
    <header class="admin-login__brand">
      <NuxtLink to="/" class="admin-login__wordmark" aria-label="KHT storefront">KHT</NuxtLink>
      <p>Admin access</p>
    </header>

    <div class="admin-login__line" aria-hidden="true"><span /></div>

    <section class="admin-login__content" aria-labelledby="admin-login-title">
      <div class="admin-login__heading">
        <p>KHT / Secure operations</p>
        <h1 id="admin-login-title">Login</h1>
      </div>

      <form class="admin-login__form" @submit.prevent="submit">
        <fieldset :disabled="busy">
          <div class="admin-login__field">
            <label for="admin-email">Email</label>
            <input
              id="admin-email"
              v-model.trim="email"
              name="email"
              type="email"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              placeholder="admin@kht.com"
              required
              :aria-invalid="error ? 'true' : undefined"
              :aria-describedby="error ? 'admin-login-error' : undefined"
            />
          </div>

          <div class="admin-login__field">
            <label for="admin-password">Password</label>
            <div class="admin-login__password">
              <input
                id="admin-password"
                v-model="password"
                name="password"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Enter your password"
                required
                :aria-invalid="error ? 'true' : undefined"
                :aria-describedby="error ? 'admin-login-error' : undefined"
              />
              <button
                type="button"
                :aria-label="passwordVisible ? 'Hide password' : 'Show password'"
                :aria-pressed="passwordVisible"
                @click="passwordVisible = !passwordVisible"
              >
                {{ passwordVisible ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>
        </fieldset>

        <p v-if="error" id="admin-login-error" class="admin-login__error" role="alert">
          {{ error }}
        </p>

        <button type="submit" class="admin-login__submit" :disabled="busy" :aria-busy="busy">
          <span>{{ busy ? 'Signing in' : 'Sign in' }}</span>
          <span v-if="busy" class="admin-login__progress" aria-hidden="true"><span /></span>
          <KhtIcon v-else name="arrow" />
        </button>
      </form>
    </section>

    <footer class="admin-login__footer">
      <p>Black. White. Line.</p>
      <span>Restricted access</span>
    </footer>
  </main>
</template>