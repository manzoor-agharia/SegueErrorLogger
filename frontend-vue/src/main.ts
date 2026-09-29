import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { registerUnauthorizedHandler } from './api/client';
import router from './router';
import { useAuthStore } from './stores/auth';
import './styles/main.scss';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// A 401 from any request clears the session and bounces to login -- the response-interceptor
// half of what Angular's authInterceptor did.
const auth = useAuthStore();
registerUnauthorizedHandler(() => {
  auth.clearSession();
  void router.push({ name: 'login' });
});

app.mount('#app');
