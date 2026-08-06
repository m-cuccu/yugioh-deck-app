import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { NotificationsProvider } from './context/NotificationsContext.jsx'
import { BanlistProvider } from './context/BanlistContext.jsx'
import { registerPWA } from './registerPWA.js'

registerPWA()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <NotificationsProvider>
            <BanlistProvider>
              <App />
            </BanlistProvider>
          </NotificationsProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
