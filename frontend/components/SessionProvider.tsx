'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { syncPreferencesWithProfile } from '@/lib/preferences'
import { API_URL } from '@/lib/api'

export type UserRole = 'customer' | 'provider' | 'admin'

interface SessionContextValue {
  session: Session | null
  user: User | null
  role: UserRole
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  role: 'customer',
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
})

async function fetchRole(token: string): Promise<UserRole> {
  try {
    const r = await fetch(`${API_URL}/api/v1/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      console.error('Failed to fetch user role:', r.status)
      return 'customer'
    }
    const j = await r.json()
    return (j.role as UserRole) || 'customer'
  } catch (err) {
    console.error('Role fetch error:', err)
    return 'customer'
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('customer')
  const [loading, setLoading] = useState(true)

  const loadRole = useCallback(async (s: Session | null) => {
    if (!s?.access_token) { setRole('customer'); return }
    setRole(await fetchRole(s.access_token))
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadRole(data.session)
  }, [loadRole])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        syncPreferencesWithProfile(data.session).catch((err) => { console.error('Preference sync failed:', err) })
        loadRole(data.session)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        syncPreferencesWithProfile(newSession).catch((err) => { console.error('Preference sync failed:', err) })
        loadRole(newSession)
      } else {
        setRole('customer')
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setRole('customer')
  }, [])

  return (
    <SessionContext.Provider
      value={{ session, user: session?.user ?? null, role, loading, signOut, refresh }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
