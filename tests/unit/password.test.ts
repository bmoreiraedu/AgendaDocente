import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { requiresPasswordChange, validatePassword } from '../../src/features/auth/password'

const userWithMetadata = (appMetadata: User['app_metadata']): User => ({
  id: 'master-user',
  app_metadata: appMetadata,
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-08-11T00:00:00.000Z',
})

describe('first-access password policy', () => {
  it('requires the first-access flow only for an explicit true flag', () => {
    expect(requiresPasswordChange(userWithMetadata({ must_change_password: true }))).toBe(true)
    expect(requiresPasswordChange(userWithMetadata({ must_change_password: false }))).toBe(false)
    expect(requiresPasswordChange(userWithMetadata({}))).toBe(false)
    expect(requiresPasswordChange(null)).toBe(false)
  })

  it.each([
    ['Short1!', 'Use pelo menos 12 caracteres.'],
    ['ALLUPPERCASE1!', 'Inclua ao menos uma letra minúscula.'],
    ['alllowercase1!', 'Inclua ao menos uma letra maiúscula.'],
    ['NoNumberHere!', 'Inclua ao menos um número.'],
    ['NoSymbolHere1', 'Inclua ao menos um símbolo.'],
  ])('rejects a weak password: %s', (password, message) => {
    expect(validatePassword(password)).toBe(message)
  })

  it('accepts a strong password', () => {
    expect(validatePassword('Agenda!Docente2026')).toBeNull()
  })
})
