
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Admin from './Admin.jsx'
import Tracking from './Tracking.jsx'
import './index.css'

const currentPath = window.location.pathname.replace(/\/+$/, '')

const isAdminRoute = currentPath === '/admin'
const isTrackingRoute = currentPath === '/track'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute ? (
      <Admin />
    ) : isTrackingRoute ? (
      <Tracking />
    ) : (
      <App />
    )}
  </StrictMode>,
)
