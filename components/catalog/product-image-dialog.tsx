'use client'
import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useCopy } from '@/components/demo/ui'

export function ProductImageDialog({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const c = useCopy()
  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    if (element && !element.open) element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="product-image-dialog"
      aria-label={c('صورة المنتج', 'Product image')}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}
    >
      <button
        autoFocus
        className="absolute end-3 top-3 z-10 rounded-full bg-white p-3 text-foreground"
        onClick={() => dialog.current?.close()}
        aria-label={c('إغلاق الصورة', 'Close image')}
      >
        <X />
      </button>
      <div className="relative aspect-square w-full">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 600px, 90vw"
          className="object-contain"
        />
      </div>
    </dialog>
  )
}
