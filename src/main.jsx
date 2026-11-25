import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './assets/schrift/outfit.css'
import App from './App.jsx'
import { starteAktualisierung } from './lib/aktualisieren'

starteAktualisierung()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
