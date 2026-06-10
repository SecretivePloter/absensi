import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'

export function Dialog({ open, onClose, children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 animate-fade-in">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ className, children, onClose, ...props }) {
  return (
    <div
      className={clsx(
        'bg-card text-card-foreground rounded-lg shadow-xl border',
        'w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto',
        className
      )}
      {...props}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  )
}

export function DialogHeader({ className, ...props }) {
  return <div className={clsx('flex flex-col space-y-1.5 p-6 pb-2', className)} {...props} />
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={clsx('text-lg font-semibold', className)} {...props} />
}

export function DialogFooter({ className, ...props }) {
  return <div className={clsx('flex justify-end gap-2 p-6 pt-2', className)} {...props} />
}
