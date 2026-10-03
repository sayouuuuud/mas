'use client'

import { useState, type FormEvent } from 'react'
import { CircleCheck } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons'
import { useLanguage } from '@/components/language-provider'
import { useQuote } from '@/components/quote-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { allBrands, whatsappLink, type ProductOption } from '@/lib/site'
import { cn } from '@/lib/utils'

type FieldError = 'name' | 'phone' | 'product'

const productOptions: ProductOption[] = ['oils', 'grease', 'bearings', 'other']

const fieldClass = 'h-11 bg-background px-3'
const selectClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm'

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}

export function QuoteForm() {
  const { t, lang } = useLanguage()
  const { product, setProduct } = useQuote()
  const [errors, setErrors] = useState<Partial<Record<FieldError, string>>>({})
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null)
  const f = t.quote.form
  const m = t.quote.message

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const read = (key: string) => String(data.get(key) ?? '').trim().slice(0, 500)

    const name = read('name')
    const company = read('company')
    const phone = read('phone')
    const brand = read('brand')
    const quantity = read('quantity')
    const notes = read('notes')

    const nextErrors: Partial<Record<FieldError, string>> = {}
    if (name.length < 2) nextErrors.name = f.errors.name
    if (!/^\d{8,15}$/.test(phone.replace(/[\s\-()+]/g, ''))) nextErrors.phone = f.errors.phone
    if (!product) nextErrors.product = f.errors.product

    setErrors(nextErrors)
    const firstInvalid = Object.keys(nextErrors)[0]
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }

    const lines = [
      m.intro,
      '',
      `${m.name}: ${name}`,
      company ? `${m.company}: ${company}` : null,
      `${m.phone}: ${phone}`,
      `${m.product}: ${f.productOptions[product as ProductOption]}`,
      brand ? `${m.brand}: ${brand}` : null,
      quantity ? `${m.quantity}: ${quantity}` : null,
      notes ? `${m.notes}: ${notes}` : null,
    ].filter((line): line is string => line !== null)

    const url = whatsappLink(lines.join('\n'))
    setWhatsappUrl(url)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <form
      id="quote"
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby="quote-form-title"
      className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <h3 id="quote-form-title" className="text-xl font-bold">
        {f.title}
      </h3>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-name">{f.name}</Label>
          <Input
            id="quote-name"
            name="name"
            autoComplete="name"
            placeholder={f.namePh}
            required
            maxLength={120}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'quote-name-error' : undefined}
            className={fieldClass}
          />
          <ErrorText id="quote-name-error" message={errors.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-company">
            {f.company} <span className="font-normal text-muted-foreground">({f.optional})</span>
          </Label>
          <Input
            id="quote-company"
            name="company"
            autoComplete="organization"
            placeholder={f.companyPh}
            maxLength={120}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-phone">{f.phone}</Label>
          <Input
            id="quote-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={f.phonePh}
            required
            maxLength={20}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'quote-phone-error' : undefined}
            className={cn(fieldClass, lang === 'ar' && 'text-end')}
          />
          <ErrorText id="quote-phone-error" message={errors.phone} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-product">{f.product}</Label>
          <select
            id="quote-product"
            name="product"
            required
            value={product}
            onChange={(event) => {
              setProduct(event.target.value as ProductOption | '')
              if (errors.product) setErrors((current) => ({ ...current, product: undefined }))
            }}
            aria-invalid={Boolean(errors.product)}
            aria-describedby={errors.product ? 'quote-product-error' : undefined}
            className={cn(selectClass, !product && 'text-muted-foreground')}
          >
            <option value="" disabled>
              {f.productPh}
            </option>
            {productOptions.map((option) => (
              <option key={option} value={option} className="text-foreground">
                {f.productOptions[option]}
              </option>
            ))}
          </select>
          <ErrorText id="quote-product-error" message={errors.product} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-brand">
            {f.brand} <span className="font-normal text-muted-foreground">({f.optional})</span>
          </Label>
          <select id="quote-brand" name="brand" defaultValue="" className={selectClass}>
            <option value="">{f.brandAny}</option>
            {allBrands.map((brand) => (
              <option key={brand.name.en} value={brand.name[lang]}>
                {brand.name[lang]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-quantity">
            {f.quantity} <span className="font-normal text-muted-foreground">({f.optional})</span>
          </Label>
          <Input
            id="quote-quantity"
            name="quantity"
            placeholder={f.quantityPh}
            maxLength={120}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="quote-notes">
            {f.notes} <span className="font-normal text-muted-foreground">({f.optional})</span>
          </Label>
          <Textarea
            id="quote-notes"
            name="notes"
            rows={4}
            placeholder={f.notesPh}
            maxLength={500}
            className="min-h-28 bg-background px-3 py-2.5"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" className="h-12 w-full gap-2 text-base font-semibold">
          <WhatsAppIcon className="size-5" />
          {f.submit}
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground">{f.hint}</p>
        <div aria-live="polite">
          {whatsappUrl ? (
            <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm leading-relaxed">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                {f.success}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </form>
  )
}
