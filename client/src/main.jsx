import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/geist';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/pages.css';
import './styles/admin.css';

import { App } from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { CartProvider } from './lib/cart.jsx';
import { ToastProvider } from './lib/toast.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
