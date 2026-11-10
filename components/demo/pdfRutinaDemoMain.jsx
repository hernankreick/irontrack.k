// Entrada de la demo del PDF de rutina (demo/pdf-rutina.html): datos ficticios, sin conexion a datos ni red propia.
// Solo se compila en builds de Preview (vite.config.js). NO importa App.jsx ni el cliente de datos.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import '../../index.css'
import PdfRutinaDemo from './PdfRutinaDemo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<PdfRutinaDemo />)
