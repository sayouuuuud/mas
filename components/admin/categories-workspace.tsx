'use client'

import Link from 'next/link'
import { Menu } from '@base-ui/react/menu'
import {
  ChevronDown,
  CircleDot,
  Droplet,
  ExternalLink,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useId, useState } from 'react'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  useCopy,
} from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { api, formatApiError, listAllRecords } from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import type {
  CategoryRecord,
  ProductFamily,
  PublicationStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useConfirmAction } from './frontend-tools'
import {
  PublicationPill,
  publicationLabels,
  WorkspaceHeading,
  WorkspaceSurface,
} from './workspace-ui'

const familyIcons = {
  oils: { icon: Droplet, color: 'bg-primary/10 text-primary' },
  grease: { icon: Layers, color: 'bg-accent/20 text-amber-900' },
  bearings: { icon: CircleDot, color: 'bg-slate-100 text-slate-700' },
} satisfies Record<ProductFamily, { icon: typeof Layers; color: string }>

const rowLayout =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 sm:px-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem_7rem]'
const actionStyle =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const menuItemStyle =
  'flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none data-highlighted:bg-muted'

type CategoryEntry = { category: CategoryRecord; depth: number }

function createGroups(categories: CategoryRecord[]) {
  const children = new Map<string, CategoryRecord[]>()
  for (const category of categories) {
    if (!category.parentId) continue
    const siblings = children.get(category.parentId) || []
    siblings.push(category)
    children.set(category.parentId, siblings)
  }

  const seen = new Set<string>()
  function branch(category: CategoryRecord, depth: number): CategoryEntry[] {
    if (seen.has(category.id)) return []
    seen.add(category.id)
    return [
      { category, depth },
      ...(children.get(category.id) || []).flatMap((child) =>
        branch(child, depth + 1),
      ),
    ]
  }
  const groups = categories
    .filter((category) => !category.parentId)
    .map((root) => ({ root, entries: branch(root, 0).slice(1) }))
  const ungrouped = categories.flatMap((category) => branch(category, 1))
  return { groups, ungrouped }
}

function CategoryIcon({
  family,
  className,
}: {
  family?: ProductFamily
  className?: string
}) {
  const style = family ? familyIcons[family] : undefined
  const Icon = style?.icon || Layers
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-lg',
        style?.color || 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
  )
}

function CategoryActions({
  category,
  onDelete,
  busy,
}: {
  category: CategoryRecord
  onDelete: (category: CategoryRecord) => void
  busy: boolean
}) {
  const { lang } = useLanguage()
  const c = useCopy()
  const name = category.name[lang]
  const publicPath = `/${lang}/categories/${category.slug || category.id}`
  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5">
      <Link
        href={`/admin/categories/${category.id}`}
        aria-label={c(`تعديل ${name}`, `Edit ${name}`)}
        title={c('تعديل', 'Edit')}
        className={actionStyle}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Link>
      <Menu.Root>
        <Menu.Trigger
          className={actionStyle}
          aria-label={c(`إجراءات ${name}`, `Actions for ${name}`)}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="end" className="z-[90]">
            <Menu.Popup className="min-w-44 rounded-xl border bg-card p-1.5 text-card-foreground shadow-lg outline-none">
              {category.status === 'published' && (
                <Menu.LinkItem
                  href={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={menuItemStyle}
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {c('عرض في الكتالوج', 'View in catalog')}
                </Menu.LinkItem>
              )}
              {!category.parentId && (
                <Menu.LinkItem
                  href={`/admin/categories/new?parentId=${category.id}`}
                  className={menuItemStyle}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {c('إضافة تصنيف فرعي', 'Add subcategory')}
                </Menu.LinkItem>
              )}
              <Menu.Item
                disabled={busy}
                className={cn(
                  menuItemStyle,
                  'text-red-700 data-highlighted:bg-red-50 data-disabled:opacity-50',
                )}
                onClick={() => onDelete(category)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {c('حذف التصنيف', 'Delete category')}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}

function CategoryRows({
  entries,
  onDelete,
  busy,
}: {
  entries: CategoryEntry[]
  onDelete: (category: CategoryRecord) => void
  busy: boolean
}) {
  const { lang } = useLanguage()
  const otherLanguage = lang === 'ar' ? 'en' : 'ar'
  return (
    <ul className="divide-y divide-border/65">
      {entries.map(({ category, depth }) => (
        <li
          key={category.id}
          className={cn(
            rowLayout,
            'py-2.5 transition-colors hover:bg-muted/40',
          )}
        >
          <div
            className="col-start-1 row-start-1 min-w-0"
            style={{ paddingInlineStart: 3 + Math.min(depth - 1, 3) * 14 }}
          >
            <div className="border-s-2 border-border ps-3">
              <Link
                href={`/admin/categories/${category.id}`}
                dir="auto"
                className="block w-fit max-w-full break-words text-start text-sm font-semibold hover:text-primary hover:underline"
              >
                {category.name[lang]}
              </Link>
              <span className="mt-0.5 block break-words text-start text-xs text-muted-foreground">
                <bdi>{category.name[otherLanguage]}</bdi>
              </span>
            </div>
          </div>
          <span
            className="hidden truncate text-start font-mono text-xs text-muted-foreground xl:col-start-2 xl:row-start-1 xl:block"
            title={category.slug}
          >
            <bdi dir="ltr">{category.slug ? `/${category.slug}` : '—'}</bdi>
          </span>
          <div className="col-start-1 row-start-2 ms-4 xl:col-start-3 xl:row-start-1 xl:ms-0">
            <PublicationPill status={category.status} lang={lang} />
          </div>
          <div className="col-start-2 row-start-1 row-span-2 xl:col-start-4 xl:row-span-1">
            <CategoryActions
              category={category}
              onDelete={onDelete}
              busy={busy}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function CategoriesWorkspace() {
  const c = useCopy()
  const { lang } = useLanguage()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PublicationStatus | ''>('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const { confirm, confirmation } = useConfirmAction()
  const searchId = useId()
  const query = useLiveQuery('/admin/categories?page=1&pageSize=48', () =>
    listAllRecords<CategoryRecord>('categories'),
  )
  const categories = [...(query.data || [])].sort(
    (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      a.name[lang].localeCompare(b.name[lang], lang),
  )
  const { groups, ungrouped } = createGroups(categories)
  const activeGroup = groups.find(({ root }) => root.id === selectedGroup)
  const formatCount = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en')
  const needle = search.trim().toLowerCase().replace(/^\//, '')
  const searching = Boolean(needle || status)
  const matchesText = (category: CategoryRecord) =>
    !needle ||
    [category.name.ar, category.name.en, category.slug].some((value) =>
      value?.toLowerCase().includes(needle),
    )
  const matchesStatus = (category: CategoryRecord) =>
    !status || (category.status || 'draft') === status

  const visibleGroups = (activeGroup ? [activeGroup] : groups)
    .map(({ root, entries }) => {
      const matchingEntries = entries.filter(
        ({ category }) =>
          matchesStatus(category) &&
          (matchesText(root) || matchesText(category)),
      )
      return {
        root,
        entries: matchingEntries,
        rootMatches: matchesText(root) && matchesStatus(root),
      }
    })
    .filter(({ rootMatches, entries }) => rootMatches || entries.length)
  const unmatchedEntries = activeGroup
    ? []
    : ungrouped.filter(
        ({ category }) => matchesText(category) && matchesStatus(category),
      )
  const matchingCount = visibleGroups.reduce(
    (count, group) => count + group.entries.length + Number(group.rootMatches),
    unmatchedEntries.length,
  )
  const firstPopulatedGroup = visibleGroups.find(
    ({ entries }) => entries.length,
  )

  function resetFilters() {
    setSearch('')
    setStatus('')
    setSelectedGroup('')
    setOpenGroups({})
  }

  function requestDelete(category: CategoryRecord) {
    if (busy) return
    const name = category.name[lang]
    confirm(c(`هل تريد حذف «${name}»؟`, `Delete “${name}”?`), () => {
      void deleteCategory(category)
    })
  }

  async function deleteCategory(category: CategoryRecord) {
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      await api(`/admin/categories/${category.id}`, {
        method: 'DELETE',
        body: { version: category.version },
      })
      if (category.id === selectedGroup) setSelectedGroup('')
      invalidateLiveQueries(
        (key) =>
          key.startsWith('/admin/categories') ||
          key.startsWith('/content/categories') ||
          key.startsWith('/catalog/') ||
          key.startsWith('/public/'),
      )
      await query.refresh()
      setFeedback(c('تم حذف التصنيف.', 'Category deleted.'))
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <WorkspaceHeading
        title={c('التصنيفات', 'Categories')}
        description={
          query.data && (
            <p>
              {c(
                `${formatCount.format(groups.length)} مجموعات رئيسية · ${formatCount.format(categories.length - groups.length)} تصنيفًا فرعيًا`,
                `${formatCount.format(groups.length)} main categories · ${formatCount.format(categories.length - groups.length)} subcategories`,
              )}
            </p>
          )
        }
        actions={
          <Link
            href={
              activeGroup
                ? `/admin/categories/new?parentId=${activeGroup.root.id}`
                : '/admin/categories/new'
            }
            className="btn-primary min-h-11"
          >
            <Plus className="size-[18px]" aria-hidden="true" />
            {c('إضافة تصنيف فرعي', 'Add subcategory')}
          </Link>
        }
      />

      {feedback && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {feedback}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {query.isLoading ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState
          error={query.error}
          onRetry={() => void query.refresh().catch(() => {})}
        />
      ) : (
        <>
          <div
            role="group"
            aria-label={c(
              'التصفية حسب المجموعة الرئيسية',
              'Filter by main category',
            )}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3.5"
          >
            {groups.map(({ root, entries }) => {
              const selected = activeGroup?.root.id === root.id
              return (
                <button
                  key={root.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 text-start transition-colors sm:p-4',
                    selected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'hover:border-primary/45 hover:bg-primary/3',
                  )}
                  onClick={() => {
                    setSelectedGroup(selected ? '' : root.id)
                    setOpenGroups({})
                  }}
                >
                  <CategoryIcon family={root.family} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-bold sm:text-base">
                      {root.name[lang]}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c('تصنيفات فرعية', 'Subcategories')}
                    </span>
                  </span>
                  <strong className="text-xl leading-none font-semibold tabular-nums">
                    {formatCount.format(entries.length)}
                  </strong>
                </button>
              )
            })}
          </div>

          <WorkspaceSurface>
            <section aria-labelledby="category-directory-title">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2
                    id="category-directory-title"
                    className="text-base font-bold"
                  >
                    {activeGroup?.root.name[lang] ||
                      c('كل المجموعات', 'All groups')}
                  </h2>
                  <span role="status" className="text-xs text-muted-foreground">
                    {c(
                      `${formatCount.format(matchingCount)} تصنيف`,
                      `${formatCount.format(matchingCount)} categories`,
                    )}
                  </span>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <div className="relative w-full sm:w-64 xl:w-72">
                    <label htmlFor={searchId} className="sr-only">
                      {c('البحث في التصنيفات', 'Search categories')}
                    </label>
                    <Search
                      className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      id={searchId}
                      type="search"
                      className="h-11 w-full rounded-lg border border-input bg-background ps-10 pe-11 text-sm outline-primary placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                      placeholder={c(
                        'ابحث بالاسم أو الرابط…',
                        'Search by name or URL…',
                      )}
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value)
                        setOpenGroups({})
                      }}
                    />
                    {search && (
                      <button
                        type="button"
                        className={cn(actionStyle, 'absolute end-0.5 top-0.5')}
                        aria-label={c('مسح البحث', 'Clear search')}
                        onClick={() => setSearch('')}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label={c('حالة النشر', 'Publication status')}
                    className="h-11 min-w-0 grow rounded-lg border border-input bg-background px-3 text-sm outline-primary sm:w-40 sm:grow-0"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value as PublicationStatus | '')
                      setOpenGroups({})
                    }}
                  >
                    <option value="">{c('كل الحالات', 'All statuses')}</option>
                    {Object.entries(publicationLabels[lang]).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  {(searching || activeGroup) && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="min-h-10 shrink-0 px-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {c('مسح الفلاتر', 'Clear filters')}
                    </button>
                  )}
                </div>
              </div>

              {matchingCount === 0 ? (
                <EmptyState
                  title={c('مفيش تصنيفات مطابقة', 'No matching categories')}
                  description={c(
                    'جرّب اسمًا مختلفًا أو غيّر المجموعة أو حالة النشر.',
                    'Try a different name, group, or publication status.',
                  )}
                />
              ) : (
                <div className="divide-y divide-border">
                  <div
                    aria-hidden="true"
                    className={cn(
                      rowLayout,
                      'hidden bg-muted/40 py-2.5 text-xs font-semibold text-muted-foreground xl:grid',
                    )}
                  >
                    <span>{c('التصنيف', 'Category')}</span>
                    <span>{c('رابط الكتالوج', 'Catalog URL')}</span>
                    <span>{c('الحالة', 'Status')}</span>
                    <span className="text-end">
                      {c('الإجراءات', 'Actions')}
                    </span>
                  </div>
                  {visibleGroups.map(({ root, entries, rootMatches }) => {
                    const open =
                      openGroups[root.id] ??
                      (searching ||
                        Boolean(activeGroup) ||
                        root.id === firstPopulatedGroup?.root.id)
                    return (
                      <div key={root.id}>
                        <div className={cn(rowLayout, 'bg-muted/65 py-2.5')}>
                          <button
                            type="button"
                            className="col-start-1 row-start-1 flex min-h-10 min-w-0 items-center gap-2.5 text-start"
                            aria-expanded={open}
                            aria-controls={`category-group-${root.id}`}
                            onClick={() =>
                              setOpenGroups((current) => ({
                                ...current,
                                [root.id]: !open,
                              }))
                            }
                          >
                            <ChevronDown
                              className={cn(
                                'size-4 shrink-0 text-muted-foreground transition-transform',
                                !open && '-rotate-90 rtl:rotate-90',
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0">
                              <span className="block break-words text-sm font-bold">
                                {root.name[lang]}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {c(
                                  `${formatCount.format(entries.length)} فرعي`,
                                  `${formatCount.format(entries.length)} subcategories`,
                                )}
                              </span>
                            </span>
                          </button>
                          <span className="hidden truncate text-start font-mono text-xs text-muted-foreground xl:col-start-2 xl:row-start-1 xl:block">
                            <bdi dir="ltr">
                              {root.slug ? `/${root.slug}` : '—'}
                            </bdi>
                          </span>
                          {(!status || rootMatches) && (
                            <div className="col-start-1 row-start-2 ms-6 xl:col-start-3 xl:row-start-1 xl:ms-0">
                              <PublicationPill
                                status={root.status}
                                lang={lang}
                              />
                            </div>
                          )}
                          <div className="col-start-2 row-start-1 row-span-2 xl:col-start-4 xl:row-span-1">
                            <CategoryActions
                              category={root}
                              onDelete={requestDelete}
                              busy={busy}
                            />
                          </div>
                        </div>
                        <div
                          id={`category-group-${root.id}`}
                          hidden={!open}
                          className="border-t border-border/65"
                        >
                          {entries.length ? (
                            <CategoryRows
                              entries={entries}
                              onDelete={requestDelete}
                              busy={busy}
                            />
                          ) : (
                            <p className="px-5 py-4 text-sm text-muted-foreground">
                              {c(
                                'مفيش تصنيفات فرعية مطابقة في المجموعة دي.',
                                'No matching subcategories in this group.',
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {unmatchedEntries.length > 0 && (
                    <div>
                      <h3 className="bg-muted/65 px-5 py-3 text-sm font-bold">
                        {c(
                          'تصنيفات تحتاج ربط بمجموعة',
                          'Categories without a main group',
                        )}
                      </h3>
                      <CategoryRows
                        entries={unmatchedEntries}
                        onDelete={requestDelete}
                        busy={busy}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </WorkspaceSurface>
        </>
      )}
      {confirmation}
    </div>
  )
}
