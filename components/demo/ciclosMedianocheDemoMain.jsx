// Punto de entrada de la demostración D76-04/05 (demo/ciclos-medianoche.html). Mismas fuentes y estilos globales que
// main.jsx; NO importa App.jsx ni lib/supabaseClient.js. Solo se compila en builds de Preview (vite.config.js).
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import CiclosMedianocheDemo from './CiclosMedianocheDemo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<CiclosMedianocheDemo />)
