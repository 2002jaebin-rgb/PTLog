import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // ✅ Tailwind 연결
import './styles/theme.css' // ✅ 기존 다크테마 색상 유지

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
