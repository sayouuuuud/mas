'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCopy } from '@/components/demo/ui'

export function downloadText(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
) {
  const blob = new Blob(['\uFEFF' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useUnsavedChanges(dirty: boolean) {
  const c = useCopy()
  useEffect(() => {
    if (!dirty) return
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const navigate = (event: MouseEvent) => {
      const link = (event.target as HTMLElement)?.closest('a')
      if (
        !link ||
        link.target === '_blank' ||
        link.getAttribute('href')?.startsWith('#') ||
        !link.href ||
        link.href === window.location.href
      )
        return
      if (
        !window.confirm(
          c(
            'لديك تعديلات غير محفوظة. هل تريد مغادرة الصفحة؟',
            'You have unsaved changes. Leave this page?',
          ),
        )
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', navigate, true)
    }
  }, [dirty, c])
}

function ConfirmDialog({
  message,
  action,
  close,
}: {
  message: string
  action: () => void
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const c = useCopy()
  useEffect(() => {
    const element = ref.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={(event) => {
        if (!event.currentTarget.open) close()
      }}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title" className="text-xl font-bold">
        {c('تأكيد الإجراء', 'Confirm action')}
      </h2>
      <p className="my-5 leading-8 text-muted-foreground">{message}</p>
      <div className="flex justify-end gap-3">
        <button type="button" autoFocus className="btn-outline" onClick={close}>
          {c('إلغاء', 'Cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            action()
            close()
          }}
        >
          {c('تأكيد', 'Confirm')}
        </button>
      </div>
    </dialog>
  )
}

export function useConfirmAction() {
  const [pending, setPending] = useState<{
    message: string
    action: () => void
  } | null>(null)
  return {
    confirm: (message: string, action: () => void) =>
      setPending({ message, action }),
    confirmation: pending ? (
      <ConfirmDialog {...pending} close={() => setPending(null)} />
    ) : null,
  }
}

export function Pagination({
  page,
  pages,
  onChange,
  total,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
  total: number
}) {
  const c = useCopy()
  return (
    <nav
      className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm"
      aria-label={c('ترقيم الصفحات', 'Pagination')}
    >
      <span className="text-muted-foreground">
        {total} {c('سجل', 'records')} · {c('صفحة', 'Page')} {page}/{pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-outline"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {c('السابق', 'Previous')}
        </button>
        <button
          type="button"
          className="btn-outline"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {c('التالي', 'Next')}
        </button>
      </div>
    </nav>
  )
}

export function Tabs({
  value,
  onChange,
  items,
  label,
}: {
  value: string
  onChange: (id: string) => void
  items: { id: string; label: string }[]
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="admin-tabs"
      onKeyDown={(event) => {
        const index = items.findIndex((t) => t.id === value)
        let target = -1
        if (event.key === 'ArrowRight') target = (index + 1) % items.length
        if (event.key === 'ArrowLeft')
          target = (index - 1 + items.length) % items.length
        if (event.key === 'Home') target = 0
        if (event.key === 'End') target = items.length - 1
        if (target >= 0) {
          event.preventDefault()
          onChange(items[target].id)
          ;(event.currentTarget.children[target] as HTMLButtonElement).focus()
        }
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`tab-${item.id}`}
          aria-selected={value === item.id}
          aria-controls={`panel-${item.id}`}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function PreviewDialog({
  children,
  close,
  label,
}: {
  children: ReactNode
  close: () => void
  label: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const c = useCopy()
  useEffect(() => {
    const element = ref.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="confirm-dialog media-native-dialog"
      aria-label={label}
      onClose={close}
    >
      <button
        type="button"
        autoFocus
        className="btn-outline mb-4"
        onClick={() => ref.current?.close()}
      >
        {c('إغلاق المعاينة', 'Close preview')}
      </button>
      {children}
    </dialog>
  )
}
