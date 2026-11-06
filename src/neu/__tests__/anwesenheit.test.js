import { describe, it, expect } from 'vitest'
import { anwesenheitErfasst, istOffen } from '../lehrerDaten'

const vorbei = new Date(Date.now() - 3600000).toISOString()
const kommend = new Date(Date.now() + 3600000).toISOString()
const unterricht = { unterricht_schueler: [{ status: 'aktiv' }] }
const stunde = extra => ({ status: 'stattgefunden', ende: vorbei, unterricht, anwesenheit: [], ...extra })

describe('anwesenheitErfasst', () => {
  it('zählt reine Selbst-Absagen nicht als erfasst', () => {
    expect(anwesenheitErfasst({ anwesenheit: [{ status: 'entschuldigt', erfasst_von: null }] })).toBe(false)
  })

  it('erkennt erfasste Einträge', () => {
    expect(anwesenheitErfasst({ anwesenheit: [{ status: 'entschuldigt', erfasst_von: 'lehrer' }] })).toBe(true)
    expect(anwesenheitErfasst({ anwesenheit: [{ status: 'anwesend', erfasst_von: null }] })).toBe(true)
  })
})

describe('istOffen', () => {
  it('ist offen, wenn der Cron eine Stunde ohne Anwesenheit auf stattgefunden gesetzt hat', () => {
    expect(istOffen(stunde())).toBe(true)
  })

  it('ist nicht offen, wenn die Anwesenheit erfasst ist', () => {
    expect(istOffen(stunde({ anwesenheit: [{ status: 'anwesend', erfasst_von: 'lehrer' }] }))).toBe(false)
  })

  it('ignoriert abgesagte, künftige und teilnehmerlose Stunden', () => {
    expect(istOffen(stunde({ status: 'abgesagt' }))).toBe(false)
    expect(istOffen(stunde({ status: 'geplant', ende: kommend }))).toBe(false)
    expect(istOffen(stunde({ unterricht: { unterricht_schueler: [] } }))).toBe(false)
  })
})
