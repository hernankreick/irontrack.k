// Entrada de la demo del temporizador de descanso (demo/temporizador-descanso.html, PR #183): datos ficticios, sin login ni conexion a datos.
// Solo se compila en builds de Preview (vite.config.js). NO importa App.jsx ni el cliente de datos.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import RestTimerDemo from './RestTimerDemo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<RestTimerDemo />)
