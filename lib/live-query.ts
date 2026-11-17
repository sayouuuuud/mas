'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { BackendError } from './api-client'

type CacheEntry<T = unknown> = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data?: T
  error?: BackendError | Error
  updatedAt: number
  stale: boolean
  promise?: Promise<T>
  fetcher?: () => Promise<T>
}

const store = new Map<string, CacheEntry<any>>()
const listeners = new Map<string, Set<() => void>>()
let globalGeneration = 0
const globalListeners = new Set<() => void>()

function emit(key: string) {
  const subs = listeners.get(key)
  if (subs) subs.forEach((fn) => fn())
  globalListeners.forEach((fn) => fn())
}

function subscribeKey(key: string | null, callback: () => void) {
  if (!key) return () => {}
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(callback)
  return () => {
    const current = listeners.get(key)
    if (!current) return
    current.delete(callback)
    if (!current.size) listeners.delete(key)
  }
}

function isPrivateKey(key: string): boolean {
  return key.startsWith('/admin') || key.startsWith('/auth') || key.startsWith('admin:') || key.startsWith('auth:')
}

export function clearPrivateLiveQueries() {
  globalGeneration++
  for (const key of Array.from(store.keys())) {
    if (isPrivateKey(key)) {
      store.delete(key)
      emit(key)
    }
  }
}

async function runFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  force = false,
): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined
  if (existing?.promise && !force) return existing.promise

  const genAtStart = globalGeneration
  const nextEntry: CacheEntry<T> = {
    status: existing?.data !== undefined ? existing.status : 'loading',
    data: existing?.data,
    error: undefined,
    updatedAt: existing?.updatedAt || 0,
    stale: false,
    fetcher,
  }

  const promise = fetcher()
    .then((data) => {
      if (store.get(key) !== nextEntry || (isPrivateKey(key) && genAtStart !== globalGeneration)) {
        return data
      }
      store.set(key, {
        status: 'success',
        data,
        error: undefined,
        updatedAt: Date.now(),
        stale: false,
        fetcher,
      })
      emit(key)
      return data
    })
    .catch((err: unknown) => {
      const normalized =
        err instanceof Error ? err : new Error('Request failed.')
      if (store.get(key) !== nextEntry || (isPrivateKey(key) && genAtStart !== globalGeneration)) throw normalized
      const unauthorized = normalized instanceof BackendError && [401, 403].includes(normalized.status) && isPrivateKey(key)
      if (
        normalized instanceof BackendError &&
        normalized.status === 401 &&
        isPrivateKey(key)
      ) {
        clearPrivateLiveQueries()
      }
      store.set(key, {
        status: 'error',
        data: unauthorized ? undefined : existing?.data,
        error: normalized,
        updatedAt: Date.now(),
        stale: false,
        fetcher,
      })
      emit(key)
      throw normalized
    })

  nextEntry.promise = promise
  store.set(key, nextEntry)
  emit(key)
  return promise
}

export function invalidateLiveQueries(
  matcher?: string | ((key: string) => boolean),
) {
  const matches = (key: string) => {
    if (!matcher) return true
    if (typeof matcher === 'string') return key.startsWith(matcher)
    return matcher(key)
  }

  for (const [key, entry] of store.entries()) {
    if (!matches(key)) continue
    entry.stale = true
    const hasSubscribers = (listeners.get(key)?.size || 0) > 0
    if (hasSubscribers && entry.fetcher) {
      void runFetch(key, entry.fetcher, true).catch(() => {
        // Subscriber receives error through store state
      })
    } else {
      emit(key)
    }
  }
}

export function setLiveQueryData<T>(key: string, data: T) {
  const existing = store.get(key)
  store.set(key, {
    status: 'success',
    data,
    error: undefined,
    updatedAt: Date.now(),
    stale: false,
    fetcher: existing?.fetcher,
  })
  emit(key)
}

const IDLE_ENTRY: CacheEntry<any> = Object.freeze({
  status: 'idle',
  data: undefined,
  error: undefined,
  updatedAt: 0,
  stale: true,
})

export function useLiveQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: {
    staleTimeMs?: number
  } = {},
) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const staleTimeMs = options.staleTimeMs ?? 15000

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeKey(key, onStoreChange),
    [key],
  )
  const getSnapshot = useCallback((): CacheEntry<T> => {
    if (!key) return IDLE_ENTRY
    return (store.get(key) as CacheEntry<T>) || IDLE_ENTRY
  }, [key])

  const entry = useSyncExternalStore<CacheEntry<T>>(subscribe, getSnapshot, () => IDLE_ENTRY)

  useEffect(() => {
    if (!key) return
    const current = store.get(key) as CacheEntry<T> | undefined
    if (current) current.fetcher = () => fetcherRef.current()
    const isFresh =
      current &&
      !current.stale &&
      current.status === 'success' &&
      Date.now() - current.updatedAt < staleTimeMs
    if (!current || (!current.promise && !isFresh && current.status !== 'error')) {
      void runFetch(key, () => fetcherRef.current()).catch(() => {
        // Handled in store snapshot
      })
    } else if (current.stale && !current.promise) {
      void runFetch(key, () => fetcherRef.current(), true).catch(() => {
        // Handled in store snapshot
      })
    }
  }, [key, staleTimeMs])

  const refresh = useCallback(async () => {
    if (!key) return undefined
    return runFetch(key, () => fetcherRef.current(), true)
  }, [key])

  return {
    data: entry.data,
    error: entry.error,
    isLoading: Boolean(key) && entry.data === undefined && entry.error === undefined,
    isValidating: Boolean(entry.promise),
    refresh,
  }
}
