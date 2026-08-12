import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'

interface AuthValue {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true
    void (async () => {
      const { data } = await supabase.auth.getSession()
      let nextSession = data.session

      if (nextSession) {
        const { error } = await supabase.auth.getUser()
        if (error) {
          await supabase.auth.signOut({ scope: 'local' })
          nextSession = null
        } else {
          nextSession = (await supabase.auth.getSession()).data.session
        }
      }

      if (active) {
        setSession(nextSession)
        setLoading(false)
      }
    })()
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut()
    },
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
