// Punto de entrada de la demo QA del PR #194 (demo/qa-pr194.html). El aislamiento se importa PRIMERO (sus efectos corren antes que el resto
// de los módulos y bloquean red, almacenamiento e IndexedDB). NO importa App.jsx ni lib/supabaseClient.js. Solo se compila en Preview.
import './qaPr194Aislamiento.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '../../index.css'
import QaPr194Demo from './QaPr194Demo.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<QaPr194Demo />)
