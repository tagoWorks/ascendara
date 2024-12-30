import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './Index'
import './app.css'
import './i18n'
import { analytics } from './services/analyticsService'

window.addEventListener('beforeunload', () => {
    analytics.flushEvents()
})

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
