// ── PERSISTENT STORAGE HOOK (localStorage) ────────────────────────────────
import { useState, useCallback } from 'react'

const PREFIX = 'mkw_5k_'

export function useStorage(key, defaultValue) {
  const storageKey = PREFIX + key

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw !== null ? JSON.parse(raw) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const set = useCallback((newValue) => {
    setValue(prev => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      try {
        localStorage.setItem(storageKey, JSON.stringify(resolved))
      } catch { /* storage full */ }
      return resolved
    })
  }, [storageKey])

  const remove = useCallback(() => {
    localStorage.removeItem(storageKey)
    setValue(defaultValue)
  }, [storageKey, defaultValue])

  return [value, set, remove]
}

// Utility to reset all challenge data
export function resetAllChallengeData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
}
