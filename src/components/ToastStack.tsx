import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ToastMessage } from '../lib/types'

interface ToastStackProps {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = icons[toast.kind]
        return (
          <div className={`toast toast-${toast.kind}`} key={toast.id}>
            <span className="toast-icon">
              <Icon size={17} />
            </span>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.detail && <span>{toast.detail}</span>}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
