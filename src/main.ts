import { createApp } from 'vue'
import App from './App.vue'
import { unlockAudio } from './audio'
import './styles.css'

// click and keydown count as a user gesture everywhere, pointerdown doesn't on iOS
document.addEventListener('click', unlockAudio, { once: true, capture: true })
document.addEventListener('keydown', unlockAudio, { once: true, capture: true })

if (new URLSearchParams(location.search).has('eruda')) {
  import('eruda').then(e => e.default.init())
}

createApp(App).mount('#app')
