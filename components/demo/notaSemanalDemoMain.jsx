// Entrada de la demo de la nota semanal del entrenador (demo/nota-semanal.html): datos ficticios, sin login ni conexion a datos.
// Solo se compila en builds de Preview (vite.config.js). NO importa App.jsx ni el cliente de datos.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import NotaSemanalDemo from './NotaSemanalDemo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<NotaSemanalDemo />)
