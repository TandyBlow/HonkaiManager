// frontend/src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App);

// 将 apiClient 挂载到全局，方便在 JS 中调用


app.use(router);


app.mount('#app');
