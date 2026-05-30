import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

const icons = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertTriangle size={18} className="text-yellow-500" />,
}

const styles = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  warning: 'border-yellow-200 bg-yellow-50',
}

export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${styles[type]} max-w-sm`}>
      {icons[type]}
      <p className="text-sm text-slate-700 flex-1">{message}</p>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5">
        <X size={14} />
      </button>
    </div>
  )
}

// Hook simples para gerenciar toasts
import { useCallback } from 'react'
import { createPortal } from 'react-dom'

let _setToasts = null

export function ToastContainer() {
  const [toasts, setToasts] = useState([])
  _setToasts = setToasts

  const remove = (id) => setToasts(t => t.filter(x => x.id !== id))

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
      ))}
    </div>,
    document.body
  )
}

export function toast(message, type = 'success') {
  if (!_setToasts) return
  const id = Date.now()
  _setToasts(t => [...t, { id, message, type }])
}
