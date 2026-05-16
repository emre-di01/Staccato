/**
 * Integration tests für kritische Supabase RPCs.
 * Laufen nur gegen die lokale Supabase-Instanz (127.0.0.1:54321).
 * Ausführung: npm test  (werden automatisch übersprungen wenn lokale DB nicht erreichbar)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Lokale Supabase-Credentials aus Umgebungsvariablen.
// Werte für eine lokale `supabase start`-Instanz in .env.test eintragen
// (Vorlage: .env.test.example — niemals echte Keys committen).
const LOCAL_URL      = process.env.TEST_SUPABASE_URL
const LOCAL_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY
const LOCAL_SVC_KEY  = process.env.TEST_SUPABASE_SVC_KEY
const TEST_SCHULE_ID = '00000000-0000-0000-0000-000000000001'

// Admin-Client (service role) für Test-Setup und -Teardown
const admin = createClient(LOCAL_URL, LOCAL_SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Anon-Client für reguläre RPC-Aufrufe (wie ein echter User)
const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let localReachable = false

beforeAll(async () => {
  if (!LOCAL_URL || !LOCAL_ANON_KEY || !LOCAL_SVC_KEY) return
  try {
    const res = await fetch(`${LOCAL_URL}/rest/v1/schulen?limit=1`, {
      headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${LOCAL_ANON_KEY}` },
    })
    localReachable = res.ok
  } catch {
    localReachable = false
  }
}, 5000)

// ─── Hilfsfunktionen ──────────────────────────────────────────

async function testUserAnlegen(email, rolle = 'schueler') {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'TestPasswort123!',
    email_confirm: true,
    user_metadata: {},
  })
  if (error) throw error
  await admin.from('profiles').update({ rolle, schule_id: TEST_SCHULE_ID, letzte_schule_id: TEST_SCHULE_ID })
    .eq('id', data.user.id)
  await admin.from('schul_mitgliedschaften').insert({ user_id: data.user.id, schule_id: TEST_SCHULE_ID, rolle })
  return data.user
}

async function testUserLoeschen(userId) {
  await admin.auth.admin.deleteUser(userId)
}

// ─── Anwesenheit erfassen ─────────────────────────────────────

describe('anwesenheit_erfassen RPC', () => {
  let lehrer, schueler1, schueler2, unterrichtId, stundeId

  beforeAll(async () => {
    if (!localReachable) return

    lehrer    = await testUserAnlegen(`test-lehrer-${Date.now()}@test.invalid`, 'lehrer')
    schueler1 = await testUserAnlegen(`test-s1-${Date.now()}@test.invalid`, 'schueler')
    schueler2 = await testUserAnlegen(`test-s2-${Date.now()}@test.invalid`, 'schueler')

    // Kurs anlegen
    const { data: kurs } = await admin.from('unterricht').insert({
      name: '__Test-Kurs', typ: 'gruppe', schule_id: TEST_SCHULE_ID,
      wochentag: 'mo', uhrzeit_von: '10:00', uhrzeit_bis: '11:00',
    }).select('id').single()
    unterrichtId = kurs.id

    await admin.from('unterricht_lehrer').insert({ unterricht_id: unterrichtId, lehrer_id: lehrer.id, rolle: 'hauptlehrer' })
    await admin.from('unterricht_schueler').insert([
      { unterricht_id: unterrichtId, schueler_id: schueler1.id, status: 'aktiv' },
      { unterricht_id: unterrichtId, schueler_id: schueler2.id, status: 'aktiv' },
    ])

    // Stunde anlegen
    const { data: stunde } = await admin.from('stunden').insert({
      unterricht_id: unterrichtId,
      beginn: new Date().toISOString(), ende: new Date(Date.now() + 3600000).toISOString(),
      status: 'stattgefunden',
    }).select('id').single()
    stundeId = stunde.id
  })

  afterAll(async () => {
    if (!localReachable) return
    if (stundeId)    await admin.from('stunden').delete().eq('id', stundeId)
    if (unterrichtId) {
      await admin.from('unterricht_schueler').delete().eq('unterricht_id', unterrichtId)
      await admin.from('unterricht_lehrer').delete().eq('unterricht_id', unterrichtId)
      await admin.from('unterricht').delete().eq('id', unterrichtId)
    }
    if (lehrer)    await testUserLoeschen(lehrer.id)
    if (schueler1) await testUserLoeschen(schueler1.id)
    if (schueler2) await testUserLoeschen(schueler2.id)
  })

  it('trägt Anwesenheit für mehrere Schüler ein', async () => {
    if (!localReachable) return
    expect(stundeId).toBeDefined()

    const { error } = await admin.rpc('anwesenheit_erfassen', {
      p_schueler: [{ id: schueler1.id }, { id: schueler2.id }],
      p_stunde_id: stundeId,
    })
    expect(error).toBeNull()

    const { data } = await admin.from('anwesenheit')
      .select('schueler_id, status')
      .eq('stunde_id', stundeId)
    expect(data).toHaveLength(2)
    expect(data.every(a => a.status === 'anwesend')).toBe(true)
  })

  it('ist idempotent — zweiter Aufruf erzeugt keine Duplikate', async () => {
    if (!localReachable) return
    await admin.rpc('anwesenheit_erfassen', {
      p_schueler: [{ id: schueler1.id }],
      p_stunde_id: stundeId,
    })
    const { data } = await admin.from('anwesenheit')
      .select('id')
      .eq('stunde_id', stundeId)
      .eq('schueler_id', schueler1.id)
    expect((data ?? []).length).toBeLessThanOrEqual(1)
  })
})

// ─── Rechnungsnummer-Trigger ──────────────────────────────────

describe('Rechnungsnummer automatische Vergabe', () => {
  const angelegteIds = []

  afterAll(async () => {
    if (!localReachable || angelegteIds.length === 0) return
    await admin.from('rechnungen').delete().in('id', angelegteIds)
  })

  it('vergibt beim INSERT automatisch eine Rechnungsnummer', async () => {
    if (!localReachable) return

    // Admin-User der Schule finden
    const { data: adminUser } = await admin.from('profiles')
      .select('id').eq('schule_id', TEST_SCHULE_ID).eq('rolle', 'admin').limit(1).single()
    if (!adminUser) return // Kein Admin in Test-DB — Test überspringen

    const { data: rechnung, error } = await admin.from('rechnungen').insert({
      schule_id: TEST_SCHULE_ID,
      schueler_id: adminUser.id,
      betrag: 50.00,
      faellig_am: new Date().toISOString().split('T')[0],
      typ: 'freitext',
    }).select('id, rechnungsnummer').single()

    expect(error).toBeNull()
    expect(rechnung.rechnungsnummer).toBeDefined()
    expect(rechnung.rechnungsnummer).toMatch(/^[A-Z]+-\d{4}-\d+$/)
    angelegteIds.push(rechnung.id)
  })

  it('nummeriert sequenziell — zweite Rechnung hat höhere Nummer', async () => {
    if (!localReachable) return

    const { data: adminUser } = await admin.from('profiles')
      .select('id').eq('schule_id', TEST_SCHULE_ID).eq('rolle', 'admin').limit(1).single()
    if (!adminUser) return

    const { data: r1 } = await admin.from('rechnungen').insert({
      schule_id: TEST_SCHULE_ID, schueler_id: adminUser.id,
      betrag: 10.00, faellig_am: new Date().toISOString().split('T')[0], typ: 'freitext',
    }).select('id, rechnungsnummer').single()

    const { data: r2 } = await admin.from('rechnungen').insert({
      schule_id: TEST_SCHULE_ID, schueler_id: adminUser.id,
      betrag: 20.00, faellig_am: new Date().toISOString().split('T')[0], typ: 'freitext',
    }).select('id, rechnungsnummer').single()

    if (r1 && r2) {
      angelegteIds.push(r1.id, r2.id)
      const n1 = parseInt(r1.rechnungsnummer.split('-').at(-1))
      const n2 = parseInt(r2.rechnungsnummer.split('-').at(-1))
      expect(n2).toBeGreaterThan(n1)
    }
  })
})

// ─── mein_konto_loeschen ─────────────────────────────────────

describe('mein_konto_loeschen RPC', () => {
  it('löscht den eigenen Auth-User und Profil', async () => {
    if (!localReachable) return

    const email = `test-loeschen-${Date.now()}@test.invalid`
    const pw    = 'TestPasswort123!'

    // Test-User anlegen
    const { data: { user } } = await admin.auth.admin.createUser({
      email, password: pw, email_confirm: true,
    })
    await admin.from('profiles').update({
      rolle: 'schueler', schule_id: TEST_SCHULE_ID, letzte_schule_id: TEST_SCHULE_ID
    }).eq('id', user.id)

    // Als dieser User einloggen
    const userClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: loginErr } = await userClient.auth.signInWithPassword({ email, password: pw })
    expect(loginErr).toBeNull()

    // Konto löschen aufrufen
    const { error: rpcErr } = await userClient.rpc('mein_konto_loeschen')
    expect(rpcErr).toBeNull()

    // Profil sollte nicht mehr existieren
    const { data: profil } = await admin.from('profiles').select('id').eq('id', user.id).single()
    expect(profil).toBeNull()

    // Auth-User sollte nicht mehr existieren
    const { data: authData } = await admin.auth.admin.getUserById(user.id)
    expect(authData.user).toBeNull()
  }, 15000)
})

// ─── stunden_generieren RPC ───────────────────────────────────

describe('stunden_generieren RPC', () => {
  let unterrichtId

  afterAll(async () => {
    if (!localReachable || !unterrichtId) return
    await admin.from('stunden').delete().eq('unterricht_id', unterrichtId)
    await admin.from('unterricht').delete().eq('id', unterrichtId)
  })

  it('generiert wöchentliche Stunden für einen Kurs', async () => {
    if (!localReachable) return

    const { data: kurs, error: kursErr } = await admin.from('unterricht').insert({
      name: '__Test-Generierung', typ: 'einzel', schule_id: TEST_SCHULE_ID,
      wochentag: 'mo', uhrzeit_von: '09:00', uhrzeit_bis: '10:00',
    }).select('id').single()

    expect(kursErr).toBeNull()
    unterrichtId = kurs.id

    const von = '2026-06-01'
    const bis = '2026-06-30'

    const { data: count, error } = await admin.rpc('stunden_generieren', {
      p_unterricht_id: unterrichtId, p_von: von, p_bis: bis,
    })

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(4) // 4 Montage im Juni 2026

    const { data: stunden } = await admin.from('stunden')
      .select('id').eq('unterricht_id', unterrichtId)
    expect(stunden.length).toBe(count)
  })
})
