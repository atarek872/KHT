<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string; alt: string; sizes?: string }>(), {
  sizes: '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw',
})
const name = computed(
  () => props.src.match(/^\/images\/(campaign|tee|tracksuit|pants)\.(png|webp)$/)?.[1],
)
const source = computed(() => (name.value ? `/images/${name.value}.webp` : props.src))
const srcset = computed(() =>
  name.value
    ? [240, 480, 800, name.value === 'campaign' ? 1672 : 1086]
        .map((width) => `/images/optimized/${name.value}-${width}.webp ${width}w`)
        .join(', ')
    : undefined,
)
</script>
<template>
  <img
    :src="source"
    :srcset="srcset"
    :sizes="srcset ? sizes : undefined"
    :alt="alt"
    decoding="async"
  />
</template>
