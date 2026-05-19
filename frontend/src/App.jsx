import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import KakaoCallbackPage from './pages/KakaoCallbackPage'
import HomePage from './pages/HomePage'
import SetupPage from './pages/SetupPage'
import PlayPage from './pages/PlayPage'
import ResultPage from './pages/ResultPage'

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

const shell = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100vh',
  background: '#f5f6f8',
  borderLeft: '1px solid #e2e6ea',
  borderRight: '1px solid #e2e6ea',
  position: 'relative',
}

function App() {
  return (
    <BrowserRouter>
      <div style={shell}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
          <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/setup" element={<PrivateRoute><SetupPage /></PrivateRoute>} />
          <Route path="/play/:sessionId" element={<PrivateRoute><PlayPage /></PrivateRoute>} />
          <Route path="/result/:sessionId" element={<PrivateRoute><ResultPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
