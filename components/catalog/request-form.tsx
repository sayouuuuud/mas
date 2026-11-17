'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  PublicLink as Link,
  usePublicHref,
} from '@/components/demo/public-link'
import { usePathname, useRouter } from 'next/navigation'
import {
  usePublicContentBlock,
  useSiteInfo,
} from '@/components/demo/content-preview'
import { FileCheck2, Loader2, Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useCatalogData, useDemo } from '@/components/demo/demo-provider'
import {
  EmptyState,
  Field,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'
import {
  createIdempotencyKey,
  formatApiError,
  submitInquiry,
  submitQuoteRequest,
} from '@/lib/api-client'
import { invalidateLiveQueries } from '@/lib/live-query'

type FreeItemDraft = {
  id: string
  description: string
  quantity: number
  unitCode: string
  notes: string
}

export function RequestForm({ contact = false }: { contact?: boolean }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const { cart, setCart, hydrated, setLastSubmission } = useDemo()
  const { units } = useCatalogData()
  const privacyQuery = usePublicContentBlock('privacy')
  const router = useRouter()
  const pathname = usePathname()
  const publicHref = usePublicHref()

  const defaultUnitCode = units[0]?.code || 'piece'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [channel, setChannel] = useState<'phone' | 'whatsapp' | 'email'>('phone')
  const [notes, setNotes] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [freeItems, setFreeItems] = useState<FreeItemDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Keep a deterministic Idempotency-Key per unique submission payload so
  // network retries reuse the exact same key without duplicating records.
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(
    null,
  )

  useEffect(() => {
    if (!units.length) return
    setFreeItems((items) =>
      items.map((item) =>
        units.some((u) => u.code === item.unitCode)
          ? item
          : { ...item, unitCode: units[0].code },
      ),
    )
  }, [units])

  function getIdempotencyKey(payload: unknown): string {
    const fingerprint = JSON.stringify(payload)
    if (idempotencyRef.current?.fingerprint === fingerprint) {
      return idempotencyRef.current.key
    }
    const key = createIdempotencyKey()
    idempotencyRef.current = { fingerprint, key }
    return key
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError('')

    const policyVersion = privacyQuery.data?.policyVersion
    if (!policyVersion) {
      setError(
        privacyQuery.error
          ? formatApiError(privacyQuery.error, lang)
          : c(
              'لا يمكن استقبال الطلب حاليًا قبل نشر إصدار معتمد لسياسة الخصوصية.',
              'Submissions require an active published privacy policy version.',
            ),
      )
      return
    }

    if (!privacyAccepted) {
      setError(
        c(
          'يلزم الموافقة على سياسة الخصوصية قبل الإرسال.',
          'Please accept the privacy policy before submitting.',
        ),
      )
      return
    }

    const cleanName = name.trim()
    const cleanDigits = phone
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[\s()+-]/g, '')

    if (cleanName.length < 2 || !/^\d{8,15}$/.test(cleanDigits)) {
      setError(
        c(
          'راجع الاسم ورقم الهاتف؛ استخدم من 8 إلى 15 رقمًا.',
          'Check your name and phone number (8–15 digits).',
        ),
      )
      return
    }

    if (channel === 'email' && !email.trim()) {
      setError(
        c(
          'البريد الإلكتروني مطلوب عند اختياره كوسيلة تواصل مفضلة.',
          'Email is required when selected as your preferred contact channel.',
        ),
      )
      return
    }

    const cleanSourcePage =
      pathname && /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(pathname)
        ? pathname
        : contact
          ? `/${lang}/contact`
          : `/${lang}/request-quote`

    const customerPayload = {
      name: cleanName,
      phone: phone.trim(),
      ...(companyName.trim() ? { company: companyName.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      preferredChannel: channel,
    }

    setSubmitting(true)
    try {
      if (contact) {
        if (notes.trim().length < 3) {
          setError(
            c(
              'اكتب رسالتك بوضوح (3 أحرف على الأقل).',
              'Enter a message of at least 3 characters.',
            ),
          )
          setSubmitting(false)
          return
        }
        const inquiryPayload = {
          locale: lang,
          customer: customerPayload,
          message: notes.trim(),
          privacy: { accepted: true as const, policyVersion },
          source: { page: cleanSourcePage },
        }
        const key = getIdempotencyKey(inquiryPayload)
        const res = await submitInquiry(inquiryPayload, key)
        setLastSubmission({
          reference: res.data.reference,
          receivedAt: res.data.receivedAt,
          kind: 'inquiry',
          itemCount: 0,
        })
        invalidateLiveQueries('/admin/inquiries')
        invalidateLiveQueries('/admin/reports')
        router.push(publicHref('/request-quote/success'))
        return
      }

      if (cart.length + freeItems.length === 0) {
        setError(
          c(
            'أضف منتجًا من الكتالوج أو بندًا غير مدرج إلى طلبك أولًا.',
            'Add a catalog product or an unlisted item to your request first.',
          ),
        )
        setSubmitting(false)
        return
      }

      for (const item of freeItems) {
        if (item.description.trim().length < 3) {
          setError(
            c(
              'أكمل وصف جميع البنود غير المدرجة (3 أحرف على الأقل).',
              'Describe every custom item (at least 3 characters).',
            ),
          )
          setSubmitting(false)
          return
        }
        if (
          !Number.isFinite(item.quantity) ||
          item.quantity < 0.001 ||
          item.quantity > 99999
        ) {
          setError(
            c(
              'راجع كميات البنود المطلوبة (من 0.001 إلى 99999).',
              'Check item quantities (0.001 to 99999).',
            ),
          )
          setSubmitting(false)
          return
        }
      }

      const itemsPayload = [
        ...cart.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          unitCode: item.unitCode || defaultUnitCode,
        })),
        ...freeItems.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitCode: item.unitCode || defaultUnitCode,
          ...(item.notes.trim() ? { notes: item.notes.trim() } : {}),
        })),
      ]

      const requestPayload = {
        locale: lang,
        customer: customerPayload,
        items: itemsPayload,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        privacy: { accepted: true as const, policyVersion },
        source: { page: cleanSourcePage },
      }

      const key = getIdempotencyKey(requestPayload)
      const res = await submitQuoteRequest(requestPayload, key)
      const totalItems = itemsPayload.length
      setCart([])
      setFreeItems([])
      setLastSubmission({
        reference: res.data.reference,
        receivedAt: res.data.receivedAt,
        kind: 'request',
        itemCount: totalItems,
      })
      invalidateLiveQueries('/admin/quote-requests')
      invalidateLiveQueries('/admin/reports')
      router.push(publicHref('/request-quote/success'))
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'POLICY_CHANGED'
      ) {
        void privacyQuery.refresh()
      }
      setError(formatApiError(err, lang))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageIntro
        eyebrow={c('خلّينا نساعدك', 'LET US HELP')}
        title={
          contact
            ? c('تواصل معنا', 'Contact us')
            : c('طلب عرض سعر', 'Request a quote')
        }
        description={
          contact
            ? c(
                'كل طرق التواصل مع فريق إم إيه إس في مكان واحد.',
                'All the ways to reach the M.A.S team in one place.',
              )
            : c(
                'راجع المنتجات والكميات، وأضف أي مواصفات تحتاجها قبل إرسال الطلب.',
                'Review your products and quantities and add any specifications you need before submitting.',
              )
        }
      />
      <div className="site-container page-section">
        <form
          onSubmit={handleSubmit}
          className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]"
        >
          <section className="space-y-6">
            {!contact && (
              <div className="panel">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold">
                    {c('بنود الطلب', 'Request items')}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {cart.length + freeItems.length} / 30
                  </span>
                </div>
                {!hydrated ? (
                  <p role="status">
                    {c('تحميل اختياراتك…', 'Loading your selection…')}
                  </p>
                ) : !cart.length && !freeItems.length ? (
                  <EmptyState
                    title={c('ابدأ بتحديد احتياجك', 'Start with what you need')}
                    description={c(
                      'اختر من الكتالوج أو أضف وصفًا لمنتج غير مدرج.',
                      'Choose from the catalog or describe an unlisted product.',
                    )}
                  >
                    <Link className="btn-outline" href="/products">
                      {c('تصفح المنتجات', 'Browse products')}
                    </Link>
                  </EmptyState>
                ) : null}

                {cart.map((item) => {
                  const unitObj = units.find((u) => u.code === item.unitCode)
                  const step = item.quantityStep || (unitObj ? 10 ** -unitObj.precision : 1)
                  const min = item.minQuantity || step
                  const productTitle =
                    item.productName?.[lang] || c('منتج من الكتالوج', 'Catalog item')
                  return (
                    <div className="request-item" key={item.variantId}>
                      <div className="min-w-0 flex-1">
                        {item.productSlug ? (
                          <Link
                            className="font-bold hover:text-primary"
                            href={`/products/${item.productSlug}`}
                          >
                            {productTitle}
                          </Link>
                        ) : (
                          <p className="font-bold">{productTitle}</p>
                        )}
                        <p className="my-1 text-sm text-muted-foreground">
                          {item.variantLabel?.[lang] || ''}
                          {item.sku ? (
                            <>
                              {' · '}
                              <span dir="ltr">{item.sku}</span>
                            </>
                          ) : null}
                        </p>
                        <label className="flex items-center gap-3 text-sm">
                          {c('الكمية', 'Quantity')}
                          <input
                            aria-label={`${c('كمية', 'Quantity for')} ${productTitle}`}
                            className="control w-24"
                            type="number"
                            required
                            min={min}
                            max={99999}
                            step={step}
                            value={
                              Number.isNaN(item.quantity) ? '' : item.quantity
                            }
                            onChange={(e) =>
                              setCart((current) =>
                                current.map((i) =>
                                  i.variantId === item.variantId
                                    ? { ...i, quantity: e.target.valueAsNumber }
                                    : i,
                                ),
                              )
                            }
                          />
                          <span>
                            {unitObj?.name[lang] ||
                              item.unitName?.[lang] ||
                              item.unitCode}
                          </span>
                        </label>
                      </div>
                      <button
                        type="button"
                        className="icon-button text-red-700"
                        onClick={() =>
                          setCart((items) =>
                            items.filter((i) => i.variantId !== item.variantId),
                          )
                        }
                        aria-label={`${c('حذف', 'Remove')} ${productTitle}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}

                {freeItems.map((item, index) => {
                  const chosenUnit = units.find((u) => u.code === item.unitCode)
                  const step = chosenUnit ? 10 ** -chosenUnit.precision || 1 : 1
                  return (
                    <div className="request-item" key={item.id}>
                      <div className="flex-1 space-y-3">
                        <Field
                          label={`${c('بند غير مدرج', 'Custom item')} ${index + 1}`}
                        >
                          <textarea
                            className="control"
                            required
                            minLength={3}
                            maxLength={500}
                            rows={2}
                            value={item.description}
                            onChange={(e) =>
                              setFreeItems((items) =>
                                items.map((i) =>
                                  i.id === item.id
                                    ? { ...i, description: e.target.value }
                                    : i,
                                ),
                              )
                            }
                          />
                        </Field>
                        <div className="flex flex-wrap gap-3">
                          <Field label={c('الكمية', 'Quantity')}>
                            <input
                              className="control"
                              type="number"
                              required
                              min={step}
                              max={99999}
                              step={step}
                              value={
                                Number.isNaN(item.quantity) ? '' : item.quantity
                              }
                              onChange={(e) =>
                                setFreeItems((items) =>
                                  items.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          quantity: e.target.valueAsNumber,
                                        }
                                      : i,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label={c('الوحدة', 'Unit')}>
                            <select
                              className="control"
                              value={item.unitCode}
                              onChange={(e) =>
                                setFreeItems((items) =>
                                  items.map((i) =>
                                    i.id === item.id
                                      ? { ...i, unitCode: e.target.value }
                                      : i,
                                  ),
                                )
                              }
                            >
                              {units.length > 0 ? (
                                units.map((u) => (
                                  <option key={u.id} value={u.code}>
                                    {u.name[lang]}
                                  </option>
                                ))
                              ) : (
                                <option value="piece">
                                  {c('قطعة', 'Piece')}
                                </option>
                              )}
                            </select>
                          </Field>
                        </div>
                      </div>
                      <button
                        className="icon-button text-red-700"
                        type="button"
                        onClick={() =>
                          setFreeItems((items) =>
                            items.filter((i) => i.id !== item.id),
                          )
                        }
                        aria-label={c('حذف البند الحر', 'Remove custom item')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}

                <button
                  type="button"
                  className="btn-outline mt-5"
                  disabled={cart.length + freeItems.length >= 30}
                  onClick={() =>
                    setFreeItems((items) => [
                      ...items,
                      {
                        id: `${Date.now()}-${items.length}`,
                        description: '',
                        quantity: 1,
                        unitCode: defaultUnitCode,
                        notes: '',
                      },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  {c('إضافة منتج غير مدرج', 'Add an unlisted product')}
                </button>
              </div>
            )}

            <div className="panel">
              <h2 className="mb-6 text-xl font-bold">
                {c('بيانات التواصل', 'Contact details')}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={c('الاسم *', 'Name *')}>
                  <input
                    className="control"
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label={c('رقم الموبايل *', 'Phone *')}>
                  <input
                    className="control"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={24}
                    required
                    dir="ltr"
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label={c('الشركة (اختياري)', 'Company (optional)')}>
                  <input
                    className="control"
                    name="company"
                    autoComplete="organization"
                    maxLength={160}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </Field>
                <Field
                  label={
                    channel === 'email'
                      ? c('البريد الإلكتروني *', 'Email *')
                      : c('البريد الإلكتروني (اختياري)', 'Email (optional)')
                  }
                >
                  <input
                    className="control"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    dir="ltr"
                    required={channel === 'email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label={c('المحافظة / المدينة', 'Governorate / city')}>
                  <input
                    className="control"
                    name="city"
                    maxLength={120}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </Field>
                <Field
                  label={c('طريقة التواصل المفضلة', 'Preferred contact method')}
                >
                  <select
                    className="control"
                    name="channel"
                    value={channel}
                    onChange={(e) =>
                      setChannel(
                        e.target.value as 'phone' | 'whatsapp' | 'email',
                      )
                    }
                  >
                    <option value="phone">{c('هاتف', 'Phone')}</option>
                    <option value="whatsapp">{c('واتساب', 'WhatsApp')}</option>
                    <option value="email">
                      {c('بريد إلكتروني', 'Email')}
                    </option>
                  </select>
                </Field>
              </div>
              <div className="mt-5">
                <Field
                  label={
                    contact
                      ? c('رسالتك *', 'Message *')
                      : c(
                          'ملاحظات ومواصفات إضافية',
                          'Notes and additional specifications',
                        )
                  }
                >
                  <textarea
                    className="control"
                    name="notes"
                    required={contact}
                    minLength={contact ? 3 : undefined}
                    maxLength={2000}
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
              </div>
              <label className="mt-5 flex items-start gap-3 text-sm leading-7">
                <input
                  required
                  type="checkbox"
                  name="privacy"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  {c('اطلعت على', 'I have read the')}{' '}
                  <Link className="text-primary underline" href="/privacy">
                    {c('سياسة الخصوصية', 'privacy policy')}
                  </Link>{' '}
                  {c(
                    'وأوافق على استخدام بياناتي للتواصل بخصوص هذا الطلب.',
                    'and agree to be contacted about this request.',
                  )}
                </span>
              </label>
              {error && (
                <p className="mt-4 text-sm font-medium text-red-700" role="alert">
                  {error}
                </p>
              )}
              <button
                className="btn-primary mt-6 w-full"
                type="submit"
                disabled={submitting || privacyQuery.isLoading}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCheck2 className="size-4" />
                )}
                {submitting
                  ? c('جارٍ الإرسال…', 'Submitting…')
                  : contact
                    ? c('إرسال الرسالة', 'Send inquiry')
                    : c('إرسال طلب عرض السعر', 'Submit quote request')}
              </button>
            </div>
          </section>
          <aside className="space-y-5">
            <ContactPanel />
            <div className="panel bg-surface-tint">
              <h2 className="font-bold">
                {c('خطوات متابعة طلبك', 'How we handle your request')}
              </h2>
              <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-7 text-muted-foreground">
                <li>
                  {c(
                    'تسجيل الطلب وإصدار رقم مرجعي فوري.',
                    'Your request is recorded with a reference number.',
                  )}
                </li>
                <li>
                  {c(
                    'مراجعة المواصفات الفنية مع الفريق المختص.',
                    'Our technical team reviews your specifications.',
                  )}
                </li>
                <li>
                  {c(
                    'تأكيد التوفر والكميات وإعداد عرض السعر الرسمي.',
                    'Availability and quantities are confirmed in a formal quote.',
                  )}
                </li>
              </ol>
            </div>
          </aside>
        </form>
      </div>
    </>
  )
}

export function ContactPanel() {
  const { company, phones, addresses, hours, whatsappHref } = useSiteInfo()
  const { lang } = useLanguage()
  const c = useCopy()
  return (
    <div className="panel bg-foreground text-white">
      <h2 className="text-xl font-bold">
        {c('تواصل مباشر', 'Direct contact')}
      </h2>
      <div className="my-5 space-y-4 text-sm">
        <a className="block" dir="ltr" href={phones.mobile.href}>
          {phones.mobile.display}
        </a>
        <a className="block" dir="ltr" href={phones.office.href}>
          {phones.office.display}
        </a>
        <a className="block break-all" href={`mailto:${company.email}`}>
          {company.email}
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full border border-white/30 px-5 py-2 hover:bg-white/10"
        >
          {c('تواصل عبر واتساب', 'Chat on WhatsApp')}
        </a>
      </div>
      {hours && <p className="mb-4 text-sm">{hours[lang]}</p>}
      <div className="space-y-5 border-t border-white/20 pt-5">
        {Object.entries(addresses).map(([key, value]) => (
          <div key={key}>
            <h3 className="text-sm font-bold text-accent">
              {key === 'hq'
                ? c('الإدارة', 'Head office')
                : key === 'branch'
                  ? c('الفرع', 'Branch')
                  : c('المخازن', 'Warehouse')}
            </h3>
            <p className="mt-1 text-sm leading-7 text-white/80">
              {value[lang]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
