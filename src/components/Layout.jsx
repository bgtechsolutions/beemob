import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, DollarSign, Building2,
  Users, UserCheck, Award, Menu, LogOut
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contratos', icon: FileText, label: 'Contratos' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/proprietarios', icon: Building2, label: 'Proprietários' },
  { to: '/inquilinos', icon: Users, label: 'Inquilinos' },
  { to: '/corretores', icon: UserCheck, label: 'Corretores' },
  { to: '/comissoes', icon: Award, label: 'Comissões' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200
        flex flex-col shadow-sm transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-none">Beemob</p>
            <p className="text-xs text-slate-500 mt-0.5">Gestão de Locação</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuário + Logout */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <p className="text-xs text-slate-500 truncate flex-1">{user?.email}</p>
            <button
              onClick={signOut}
              title="Sair"
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setOpen(true)} className="p-1 rounded text-slate-600 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-slate-800">Beemob</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
