export default defineNuxtPlugin(async () => {
  const { refresh } = useCustomer()
  const bag = useBag()
  try {
    await refresh()
    await bag.restore(false)
  } catch {
    // The bag exposes a recoverable save error; browsing stays available.
  }
})
