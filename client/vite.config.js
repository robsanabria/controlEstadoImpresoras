import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El backend corre en :3008. En dev, /api y /health van hacia allá.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    proxy: {
      '/api': 'http://localhost:3008',
      '/health': 'http://localhost:3008',
    },
  },
});
