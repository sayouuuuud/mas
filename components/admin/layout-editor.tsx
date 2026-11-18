'use client'
import { useLanguage } from '@/components/language-provider'
import { MediaPicker } from './entity-tools'
export function ContentLayoutEditor({
  value,
  onChange,
}: {
  value: any
  onChange: (value: any) => void
}) {
  const { lang } = useLanguage()
  const c = (ar: string, en: string) => (lang === 'ar' ? ar : en)
  const field = (label: string, localized: any, change: (v: any) => void) => (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      {(['ar', 'en'] as const).map((l) => (
        <label key={l} className="text-xs">
          {l === 'ar' ? 'العربية' : 'English'}
          <textarea
            className="control mt-1"
            dir={l === 'ar' ? 'rtl' : 'ltr'}
            value={localized?.[l] || ''}
            onChange={(e) => change({ ...localized, [l]: e.target.value })}
          />
        </label>
      ))}
    </fieldset>
  )
  const cards = value.cards || []
  const points = value.points || []
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h3 className="text-lg font-bold">
        {c('محتوى القسم والصور', 'Section content and images')}
      </h3>
      {field(c('العنوان التمهيدي', 'Eyebrow'), value.eyebrow, (v) =>
        onChange({ ...value, eyebrow: v }),
      )}
      <MediaPicker
        value={value.imageMediaId || ''}
        onChange={(imageMediaId) =>
          onChange({ ...value, imageMediaId: imageMediaId || null })
        }
        label={c('صورة القسم', 'Section image')}
      />
      {points.map((point: any, i: number) => (
        <div key={i} className="rounded border p-3">
          {field(c(`نقطة ${i + 1}`, `Point ${i + 1}`), point, (v) =>
            onChange({
              ...value,
              points: points.map((p: any, n: number) => (n === i ? v : p)),
            }),
          )}
          <button
            type="button"
            className="text-sm text-red-700"
            onClick={() =>
              onChange({
                ...value,
                points: points.filter((_: any, n: number) => n !== i),
              })
            }
          >
            {c('حذف النقطة', 'Delete point')}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-outline"
        onClick={() =>
          onChange({ ...value, points: [...points, { ar: '', en: '' }] })
        }
      >
        {c('إضافة نقطة', 'Add point')}
      </button>
      <h4 className="font-bold">
        {c('البطاقات / شرائح الصور', 'Cards / slides')}
      </h4>
      {cards.map((card: any, i: number) => {
        const update = (patch: any) =>
          onChange({
            ...value,
            cards: cards.map((v: any, n: number) =>
              n === i ? { ...v, ...patch } : v,
            ),
          })
        return (
          <article className="space-y-3 rounded-xl border p-4" key={i}>
            {field(
              c(`عنوان البطاقة ${i + 1}`, `Card ${i + 1} title`),
              card.title,
              (v) => update({ title: v }),
            )}
            {field(c('الوصف', 'Description'), card.body, (v) =>
              update({ body: v }),
            )}
            <label className="block text-sm">
              {c('الرابط داخل الموقع', 'Internal link')}
              <input
                className="control"
                dir="ltr"
                value={card.href || ''}
                placeholder="/products"
                onChange={(e) => update({ href: e.target.value || undefined })}
              />
            </label>
            <MediaPicker
              value={card.imageMediaId || ''}
              onChange={(imageMediaId) =>
                update({ imageMediaId: imageMediaId || null })
              }
              label={c('صورة البطاقة', 'Card image')}
              alt={card.title}
            />
            <button
              type="button"
              className="btn-outline"
              disabled={i === 0}
              onClick={() => {
                const next = [...cards]
                ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                onChange({ ...value, cards: next })
              }}
            >
              ↑ {c('نقل لأعلى', 'Move up')}
            </button>
            <button
              type="button"
              className="ms-3 text-sm text-red-700"
              onClick={() =>
                onChange({
                  ...value,
                  cards: cards.filter((_: any, n: number) => n !== i),
                })
              }
            >
              {c('حذف البطاقة', 'Delete card')}
            </button>
          </article>
        )
      })}
      <button
        type="button"
        className="btn-outline"
        onClick={() =>
          onChange({
            ...value,
            cards: [
              ...cards,
              {
                title: { ar: '', en: '' },
                body: { ar: '', en: '' },
                points: [],
              },
            ],
          })
        }
      >
        {c('إضافة بطاقة / شريحة', 'Add card / slide')}
      </button>
    </section>
  )
}
