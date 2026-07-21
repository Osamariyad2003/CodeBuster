import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT || '5174'),
      host: true,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/webhooks': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/health': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/github': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/auth': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/webhook': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
