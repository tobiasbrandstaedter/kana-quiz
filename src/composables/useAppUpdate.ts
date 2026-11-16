import { useRegisterSW } from 'virtual:pwa-register/vue'

const CHECK_INTERVAL = 60 * 60 * 1000

// Keeps an installed or long-open app on the latest build. The browser only
// looks for a new service worker on navigation, so we ask it ourselves every
// hour and whenever the tab comes back into view. `needRefresh` turns true once
// the new build is downloaded and waiting; `apply` switches to it and reloads.
export function useAppUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => registration.update().catch(() => {}) // offline, try again later
      setInterval(check, CHECK_INTERVAL)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  return { needRefresh, apply: () => updateServiceWorker() }
}
