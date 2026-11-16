'use client'
import { useCopy } from '@/components/demo/ui'
export function FacetFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; label: string; count: number }[]
  onChange: (value: string) => void
}) {
  const c = useCopy()
  const selected = value.split(',').filter(Boolean)
  return (
    <fieldset className="facet-filter">
      <legend className="mb-3 w-full text-sm font-bold">
        {label}
        {selected.length > 0 && (
          <button
            type="button"
            className="float-end text-xs font-normal text-primary underline"
            onClick={() => onChange('')}
          >
            {c('مسح', 'Clear')}
          </button>
        )}
      </legend>
      <div className="max-h-52 space-y-3 overflow-y-auto pe-1">
        {options.map((option) => (
          <label
            className="flex cursor-pointer items-start gap-2 text-sm"
            key={option.id}
          >
            <input
              className="mt-1 accent-primary"
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, option.id].join(',')
                    : selected.filter((v) => v !== option.id).join(','),
                )
              }
            />
            <span className="min-w-0 flex-1">{option.label}</span>
            <span className="text-xs text-muted-foreground">
              {option.count}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
