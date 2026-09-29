import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { registerUnauthorizedHandler } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

import App from './App';
import './styles/main.scss';

// A 401 from any request clears the session; the route guard then bounces to login on the
// next render -- the response-interceptor half of what Angular's authInterceptor did.
registerUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/react">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
