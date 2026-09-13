import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './renderer/index.css';
import { App } from './renderer/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
