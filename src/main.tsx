import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font tu host trong goi npm — khong phu thuoc CDN, chay duoc trong mang noi bo benh vien.
// Be Vietnam Pro duoc thiet ke rieng cho tieng Viet nen dau thanh con ro o co chu nho.
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
// Mono cho ma thiet bi, so seri, ngay va so lieu.
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
