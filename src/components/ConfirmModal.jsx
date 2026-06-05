import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

/**
 * Modal de confirmação reutilizável
 * Props: open, onClose, onConfirm, title, message, confirmLabel, danger
 */
export default function ConfirmModal({ open, onClose, onConfirm, title = 'Confirmar', message, confirmLabel = 'Confirmar', danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title="" size="sm">
      <div className="text-center space-y-4 py-2">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${danger ? 'bg-red-100' : 'bg-yellow-100'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-yellow-500'} />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">{title}</p>
          {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={onClose}
            className="px-5 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
            Cancelar
          </button>
          <button onClick={() => { onConfirm(); onClose() }}
            className={`px-5 py-2 text-sm rounded-lg font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
