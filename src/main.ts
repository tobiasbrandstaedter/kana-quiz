import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

if (new URLSearchParams(location.search).has('eruda')) {
  import('eruda').then(e => e.default.init())
}

createApp(App).mount('#app')
