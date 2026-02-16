import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true,
      },
    },
  },
})
