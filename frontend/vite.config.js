import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: true,
    port: 5173,
    hmr: false,  // Deshabilitar HMR para compatibilidad
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  build: {
    target: 'es2015',
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vueuse')) return 'vendor-vue'
          if (id.includes('node_modules/radix-vue')) return 'vendor-ui'
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/file-saver')) return 'vendor-excel'
          if (id.includes('node_modules/jspdf')) return 'vendor-pdf'
        }
      }
    }
  },
  optimizeDeps: {
    include: ['vue']
  }
})
