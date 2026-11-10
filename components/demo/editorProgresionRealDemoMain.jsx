// Entrada de la demo del editor REAL de progresion (demo/editor-progresion.html): datos ficticios en memoria, sin conexión a datos ni red.
// Solo se compila en builds de Preview (vite.config.js). NO importa App.jsx ni el cliente de datos.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import EditorProgresionRealDemo from './EditorProgresionRealDemo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<EditorProgresionRealDemo />)
