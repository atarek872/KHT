<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string; alt: string; sizes?: string }>(), {
  sizes: '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw',
})
const name = computed(
  () => props.src.match(/^\/images\/(campaign|tee|tracksuit|pants|drop-001-banner|our-story-cover)\.(jpg|png|webp)$/)?.[1],
)
const source = computed(() => (name.value ? `/images/${name.value}.webp` : props.src))
const intrinsicWidths: Record<string, number> = {
  campaign: 1672,
  tee: 1086,
  tracksuit: 1086,
  pants: 1086,
  'drop-001-banner': 1024,
  'our-story-cover': 2659,
}
const srcset = computed(() =>
  name.value
    ? [240, 480, 800, intrinsicWidths[name.value]]
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
