// Punto de entrada de la demostración de diseño D5 del Dashboard (demo/dashboard-d5.html). Mismas fuentes y estilos globales que
// main.jsx; NO importa App.jsx ni lib/supabaseClient.js. Solo se compila en builds de Preview (vite.config.js).
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import DashboardD5Demo from './d5/DashboardD5Demo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<DashboardD5Demo />)
