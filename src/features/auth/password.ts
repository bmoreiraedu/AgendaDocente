import type { User } from '@supabase/supabase-js'

export const PASSWORD_MIN_LENGTH = 12

export function requiresPasswordChange(user: User | null): boolean {
  return user?.app_metadata?.must_change_password === true
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  if (!/[a-z]/.test(password)) return 'Inclua ao menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua ao menos uma letra maiúscula.'
  if (!/\d/.test(password)) return 'Inclua ao menos um número.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua ao menos um símbolo.'
  return null
}
