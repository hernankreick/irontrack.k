import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-sans/latin-700.css'
import '@fontsource/geist-sans/latin-800.css'
import './index.css'
import GymApp from './App.jsx'
import { DEMO_MODE } from './lib/demoMode.js'

function mount() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <GymApp />
  )
}

// Build de demo: se siembran los datos ficticios ANTES de montar la app. En cualquier otro build DEMO_MODE es `false` y esta rama
// (con su modulo) se elimina del bundle.
if (DEMO_MODE) {
  import('./demo/bootDemo.js').then(function (m) { m.bootDemo(); mount() })
} else {
  mount()
}
