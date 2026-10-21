import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { envTargetGuardPlugin } from './lib/envTargetGuardPlugin.js'
import { decideDemoBuild } from './lib/demoBuildGuard.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Build de demo (interfaz del alumno con datos ficticios, sin backend): solo si se pide explicitamente y nunca en Production.
const demoDecision = decideDemoBuild(process.env)
const isBuild = process.argv.includes('build')
if (demoDecision.error && isBuild) throw new Error(demoDecision.error)
const DEMO = demoDecision.demo

export default defineConfig({
  plugins: [envTargetGuardPlugin(), react(), tailwindcss()],
  // En demo se neutraliza Supabase: URL y clave quedan vacias en el bundle (cliente null, sin ninguna peticion a servidores).
  define: Object.assign(
    { __IRONTRACK_DEMO__: JSON.stringify(DEMO) },
    DEMO ? { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""' } : {}
  ),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
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
