import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { envTargetGuardPlugin } from './lib/envTargetGuardPlugin.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Demos con datos ficticios y sin Supabase (demo/ficha-alumno.html, demo/progreso-coach.html, demo/dashboard-coach.html, demo/mis-alumnos.html): paginas extra SOLO en builds de Preview
// de Vercel, o en local (fuera de Vercel) con IRONTRACK_DEMO=1. En Production no se compilan: ni el HTML ni su JS llegan a dist/.
const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase()
const includeDemo = vercelEnv === 'preview' || (!process.env.VERCEL && process.env.IRONTRACK_DEMO === '1')

export default defineConfig({
  plugins: [envTargetGuardPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: includeDemo
        ? { index: path.resolve(__dirname, 'index.html'), demoFicha: path.resolve(__dirname, 'demo/ficha-alumno.html'), demoDashboard: path.resolve(__dirname, 'demo/dashboard-coach.html'), demoMisAlumnos: path.resolve(__dirname, 'demo/mis-alumnos.html'), demoProgreso: path.resolve(__dirname, 'demo/progreso-coach.html') }
        : { index: path.resolve(__dirname, 'index.html') },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
