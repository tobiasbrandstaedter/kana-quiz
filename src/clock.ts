import { ref } from 'vue'

// The time the screens are computed for. A computed that calls Date.now() never notices
// time passing, so "due", "today" and the streak would freeze while the app stays open.
// This ticks once a minute and whenever the app comes back to the front.
export const clock = ref(Date.now())

function tick(): void {
  clock.value = Date.now()
}

setInterval(tick, 60_000)
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() })
