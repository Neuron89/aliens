import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: Vite on :3000 proxies /api and /socket.io to the Node server on :3002.
const API_TARGET = process.env.API_TARGET || 'http://localhost:3002'

export default defineConfig({
  plugins: [react()],
  // Bundled content packs + map definitions make one ~600 kB chunk; that's fine for a LAN app.
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_TARGET,
        ws: true,
      },
    },
  },
})
