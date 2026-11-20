// Punto de entrada de la demostración «Semana activa» (PR #196). Mismas fuentes y estilos globales que main.jsx; NO importa App.jsx
// ni lib/supabaseClient.js. Solo se compila en builds de Preview (vite.config.js). Enlace directo: ?alumno=catalina|alumno-b|alumno-c&tema=oscuro|claro
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import SemanaActivaDemo from './SemanaActivaDemo.jsx'

const q = new URLSearchParams(window.location.search)
ReactDOM.createRoot(document.getElementById('root')).render(
  <SemanaActivaDemo initialAlumno={q.get('alumno') || undefined} initialDark={q.get('tema') !== 'claro'} />
)
