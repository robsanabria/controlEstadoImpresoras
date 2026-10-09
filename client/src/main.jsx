import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Estándar visual de la plataforma (copia de plataforma/ui, no se edita acá).
import './ui/css/offal-ui.css';
// Sólo lo propio del módulo.
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
