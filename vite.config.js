import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkBuildEnv } from './scripts/buildEnvGuard.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    // Variables del entorno del proceso (Vercel) + .env* locales; el proceso tiene prioridad.
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const r = checkBuildEnv({ env, vercelEnv: process.env.VERCEL_ENV })
    r.warnings.forEach((w) => console.warn('[env] ' + w))
    if (r.errors.length) throw new Error('[env] ' + r.errors.join(' | '))
  }
  return {
  plugins: [react(), tailwindcss()],
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
}
})
