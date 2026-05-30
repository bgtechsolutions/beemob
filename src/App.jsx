import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Contratos from './pages/Contratos'
import Financeiro from './pages/Financeiro'
import Proprietarios from './pages/Proprietarios'
import Inquilinos from './pages/Inquilinos'
import Corretores from './pages/Corretores'
import Comissoes from './pages/Comissoes'

function PrivateRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="contratos" element={<Contratos />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="proprietarios" element={<Proprietarios />} />
        <Route path="inquilinos" element={<Inquilinos />} />
        <Route path="corretores" element={<Corretores />} />
        <Route path="comissoes" element={<Comissoes />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute />} />
          <Route path="/*" element={<PrivateRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Login />
}
