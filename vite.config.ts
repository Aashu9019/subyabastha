import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the packaged app can load dist/index.html over file://
  base: './',
  plugins: [react()],
});
