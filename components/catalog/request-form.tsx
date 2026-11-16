'use client'

import { useState, type FormEvent } from 'react'
import { PublicLink as Link } from '@/components/demo/public-link'
import { usePublicHref } from '@/components/demo/public-link'
import { useRouter } from 'next/navigation'
import { validQuantity } from '@/lib/frontend-model'
import { useSiteInfo } from '@/components/demo/content-preview'
import { FileCheck2, Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useDemo } from '@/components/demo/demo-provider'
import {
  DemoNotice,
  EmptyState,
  Field,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'

export function RequestForm({ contact = false }: { contact?: boolean }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const {
    products,
    cart,
    setCart,
    hydrated,
    setRequests,
    setResources,
    setLastSubmission,
    recordActivity,
  } = useDemo()
  const router = useRouter()
  const publicHref = usePublicHref()
  const [review, setReview] = useState<Record<string, string>>({})
  const [completed, setCompleted] = useState(false)
  const [freeItems, setFreeItems] = useState<
    { id: number; description: string; quantity: number; unit: string }[]
  >([])
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPreview(false)
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const rawPhone = String(data.get('phone') || '')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[\s()+-]/g, '')
    if (name.length < 2 || !/^\d{8,15}$/.test(rawPhone)) {
      setError(
        c(
          'راجع الاسم ورقم الهاتف؛ استخدم من 8 إلى 15 رقمًا.',
          'Check your name and phone number (8–15 digits).',
        ),
      )
      return
    }
    if (
      !contact &&
      cart.some(
        (item) =>
          !products.some(
            (p) =>
              p.status === 'published' &&
              p.variants.some((v) => v.id === item.variantId),
          ),
      )
    ) {
      setError(
        c(
          'أحد المنتجات لم يعد متاحًا. راجع السلة واحذف البند القديم.',
          'A selected product is no longer available. Review the cart and remove the outdated item.',
        ),
      )
      return
    }
    if (!contact && cart.length + freeItems.length === 0) {
      setError(
        c(
          'أضف منتجًا أو بندًا حرًا لطلبك أولًا.',
          'Add a catalog product or a custom item first.',
        ),
      )
      return
    }
    if (
      !contact &&
      (freeItems.some(
        (i) =>
          i.description.trim().length < 3 || !validQuantity(i.quantity, i.unit),
      ) ||
        cart.some(
          (i) =>
            !validQuantity(
              i.quantity,
              products
                .flatMap((p) => p.variants)
                .find((v) => v.id === i.variantId)?.unit.en || 'pack',
            ),
        ))
    ) {
      setError(
        c(
          'راجع وصف وكميات البنود؛ راجع الكمية وفق وحدة البيع؛ الحد الأعلى 99999.',
          'Check item descriptions and quantities (quantities matching the sales unit, up to 99999).',
        ),
      )
      return
    }
    if (
      data.get('channel') === 'email' &&
      !String(data.get('email') || '').trim()
    ) {
      setError(
        c(
          'البريد الإلكتروني مطلوب عند اختياره للتواصل.',
          'Email is required when it is your preferred contact method.',
        ),
      )
      return
    }
    setReview(
      Object.fromEntries(
        Array.from(data.entries()).map(([k, v]) => [k, String(v).trim()]),
      ),
    )
    setPreview(true)
  }
  function finishPreview() {
    if (completed) return
    setCompleted(true)
    const now = Date.now()
    const reference = contact ? `DEMO-INQ-${now}` : `DEMO-RFQ-${now}`
    if (contact)
      setResources((all) => ({
        ...all,
        inquiries: [
          ...(all.inquiries || []),
          {
            id: `new-${now}`,
            reference,
            nameAr: review.name,
            nameEn: review.name,
            email: review.email,
            phone: review.phone,
            message: review.notes,
            status: 'new',
            reply: '',
          },
        ],
      }))
    else {
      setRequests((all) => [
        ...all,
        {
          id: reference,
          name: review.name,
          company: review.company || c('عميل فردي تجريبي', 'Sample individual'),
          phone: review.phone,
          email: review.email,
          status: 'new',
          owner: '',
          date: new Date().toISOString().slice(0, 10),
          priority: 'normal',
          items: [
            ...cart.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              snapshot: (() => {
                const p = products.find((p) =>
                  p.variants.some((v) => v.id === i.variantId),
                )
                const v = p?.variants.find((v) => v.id === i.variantId)
                return p && v
                  ? {
                      name: { ...p.name },
                      sku: v.sku,
                      label: { ...v.label },
                      unit: { ...v.unit },
                    }
                  : undefined
              })(),
            })),
            ...freeItems.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unit: i.unit,
            })),
          ],
          notes: review.notes ? [review.notes] : [],
        },
      ])
      setCart([])
    }
    setLastSubmission({
      reference,
      kind: contact ? 'inquiry' : 'request',
      itemCount: contact ? 0 : cart.length + freeItems.length,
    })
    recordActivity(
      contact ? 'inquiry.preview_created' : 'request.preview_created',
      reference,
    )
    router.push(publicHref('/request-quote/success'))
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
                'راجع المنتجات والكميات، وأضف أي مواصفات تحتاجها قبل تجهيز الطلب.',
                'Review your products and quantities and add any specifications you need.',
              )
        }
      />
      <div className="site-container page-section">
        <DemoNotice />
        <form
          onChange={() => setPreview(false)}
          onSubmit={submit}
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
                  const product = products.find((p) =>
                    p.variants.some((v) => v.id === item.variantId),
                  )
                  const variant = product?.variants.find(
                    (v) => v.id === item.variantId,
                  )
                  if (!product || !variant) return null
                  return (
                    <div className="request-item" key={item.variantId}>
                      <div className="min-w-0 flex-1">
                        <Link
                          className="font-bold hover:text-primary"
                          href={`/products/${product.id}`}
                        >
                          {product.name[lang]}
                        </Link>
                        <p className="my-1 text-sm text-muted-foreground">
                          {variant.label[lang]} ·{' '}
                          <span dir="ltr">{variant.sku}</span>
                        </p>
                        <label className="flex items-center gap-3 text-sm">
                          {c('الكمية', 'Quantity')}
                          <input
                            aria-label={`${c('كمية', 'Quantity for')} ${product.name[lang]} ${variant.label[lang]}`}
                            className="control w-24"
                            type="number"
                            required
                            min={0.001}
                            max={99999}
                            step={0.001}
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
                          <span>{variant.unit[lang]}</span>
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
                        aria-label={`${c('حذف', 'Remove')} ${product.name[lang]}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}
                {freeItems.map((item, index) => (
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
                      <div className="flex gap-3">
                        <Field label={c('الكمية', 'Quantity')}>
                          <input
                            className="control"
                            type="number"
                            required
                            min={0.001}
                            max={99999}
                            step={0.001}
                            value={
                              Number.isNaN(item.quantity) ? '' : item.quantity
                            }
                            onChange={(e) =>
                              setFreeItems((items) =>
                                items.map((i) =>
                                  i.id === item.id
                                    ? { ...i, quantity: e.target.valueAsNumber }
                                    : i,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label={c('الوحدة', 'Unit')}>
                          <select
                            className="control"
                            value={item.unit}
                            onChange={(e) =>
                              setFreeItems((items) =>
                                items.map((i) =>
                                  i.id === item.id
                                    ? { ...i, unit: e.target.value }
                                    : i,
                                ),
                              )
                            }
                          >
                            {[
                              ['pack', 'عبوة', 'Pack'],
                              ['piece', 'قطعة', 'Piece'],
                              ['liter', 'لتر', 'Liter'],
                              ['kg', 'كجم', 'kg'],
                            ].map(([id, ar, en]) => (
                              <option key={id} value={id}>
                                {c(ar, en)}
                              </option>
                            ))}
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
                ))}
                <button
                  type="button"
                  className="btn-outline mt-5"
                  disabled={cart.length + freeItems.length >= 30}
                  onClick={() =>
                    setFreeItems((items) => [
                      ...items,
                      {
                        id: Date.now(),
                        description: '',
                        quantity: 1,
                        unit: 'pack',
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
                  />
                </Field>
                <Field label={c('الشركة (اختياري)', 'Company (optional)')}>
                  <input
                    className="control"
                    name="company"
                    autoComplete="organization"
                    maxLength={160}
                  />
                </Field>
                <Field
                  label={c('البريد الإلكتروني (اختياري)', 'Email (optional)')}
                >
                  <input
                    className="control"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    dir="ltr"
                  />
                </Field>
                {!contact && (
                  <>
                    <Field
                      label={c('المحافظة / المدينة', 'Governorate / city')}
                    >
                      <input
                        className="control"
                        name="city"
                        maxLength={120}
                        autoComplete="address-level2"
                      />
                    </Field>
                    <Field
                      label={c(
                        'طريقة التواصل المفضلة',
                        'Preferred contact method',
                      )}
                    >
                      <select className="control" name="channel">
                        <option value="phone">{c('هاتف', 'Phone')}</option>
                        <option value="whatsapp">
                          {c('واتساب', 'WhatsApp')}
                        </option>
                        <option value="email">
                          {c('بريد إلكتروني', 'Email')}
                        </option>
                      </select>
                    </Field>
                  </>
                )}
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
                  />
                </Field>
              </div>
              <label className="mt-5 flex items-start gap-3 text-sm leading-7">
                <input
                  required
                  type="checkbox"
                  name="privacy"
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
                <p className="mt-4 text-red-700" role="alert">
                  {error}
                </p>
              )}
              <button className="btn-primary mt-6 w-full" type="submit">
                {c('معاينة النموذج', 'Preview form')}
                <FileCheck2 className="size-4" />
              </button>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {c(
                  'واجهة تجريبية: لن تُرسل أو تُحفظ بياناتك على أي خادم.',
                  'Interface preview: your information will not be sent or stored on a server.',
                )}
              </p>
              <div aria-live="polite">
                {preview && (
                  <div className="mt-5 rounded-xl border border-primary/20 bg-surface-tint p-5">
                    <h3 className="font-bold">
                      {c(
                        'البيانات سليمة للمعاينة',
                        'Form validated for preview',
                      )}
                    </h3>
                    <p className="mt-2 text-sm leading-7">
                      {c(
                        'لم يُرسل طلب ولم يُنشأ رقم مرجعي. إرسال الطلبات سيتفعّل عند تنفيذ الباك إند.',
                        'No request was sent and no reference number was created. Submission will be enabled when the backend is implemented.',
                      )}
                    </p>
                    <dl className="my-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt>{c('الاسم', 'Name')}</dt>
                        <dd>{review.name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{c('عدد البنود', 'Item count')}</dt>
                        <dd>
                          {contact ? '—' : cart.length + freeItems.length}
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={completed}
                      onClick={finishPreview}
                    >
                      {c(
                        'اختبار تأكيد الطلب محليًا',
                        'Test local request confirmation',
                      )}
                    </button>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {c(
                        'سيظهر نموذج الطلب في لوحة الإدارة داخل هذه الجلسة فقط؛ لا يُرسل لأي جهة.',
                        'The sample appears in the admin panel for this session only. Nothing is sent externally.',
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
          <aside className="space-y-5">
            <ContactPanel />
            <div className="panel bg-surface-tint">
              <h2 className="font-bold">
                {c(
                  'ماذا يحدث بعد تفعيل الخدمة؟',
                  'Once the service is connected',
                )}
              </h2>
              <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-7 text-muted-foreground">
                <li>
                  {c(
                    'تسجيل الطلب ورقمه المرجعي.',
                    'Your request is saved with a reference.',
                  )}
                </li>
                <li>
                  {c(
                    'مراجعة المواصفات مع الفريق الفني.',
                    'The technical team reviews specifications.',
                  )}
                </li>
                <li>
                  {c(
                    'تأكيد الكميات وإعداد عرض السعر.',
                    'Quantities are confirmed and a quote is prepared.',
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

import { addresses, company, phones, whatsappLink } from '@/lib/site'
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
