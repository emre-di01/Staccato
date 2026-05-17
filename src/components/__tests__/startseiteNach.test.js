import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn() } } },
}))
vi.mock('../../context/AppContext', () => ({
  useApp: vi.fn(() => ({ session: null, rolle: null, laden: false })),
}))

import { startseiteNach } from '../ProtectedRoute'

describe('startseiteNach', () => {
  it.each([
    ['superadmin', '/superadmin'],
    ['admin',      '/admin'],
    ['lehrer',     '/lehrer'],
    ['schueler',   '/schueler'],
    ['eltern',     '/eltern'],
    ['vorstand',   '/vorstand'],
  ])('leitet %s nach %s weiter', (rolle, pfad) => {
    expect(startseiteNach(rolle)).toBe(pfad)
  })

  it('gibt /login für unbekannte Rolle zurück', () => {
    expect(startseiteNach('unbekannt')).toBe('/login')
    expect(startseiteNach(undefined)).toBe('/login')
    expect(startseiteNach('')).toBe('/login')
  })
})
