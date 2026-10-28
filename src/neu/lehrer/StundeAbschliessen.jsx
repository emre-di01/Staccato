import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Knopf, Leer, Laden, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { useStunde } from '../lehrerDaten'
import { uhrzeit, tagLabel } from '../zeit'

// Reihenfolge = Reihenfolge der Knöpfe
const STATUS = [
  ['anwesend', 'nl_da', '#15803D'],
  ['zu_spaet', 'nl_spaet', '#B45309'],
  ['entschuldigt', 'nl_entsch', '#1D4ED8'],
  ['abwesend', 'nl_fehlt', '#B91C1C'],
]

export default function StundeAbschliessen() {
  const { id } = useParams()
  const { state } = useLocation()
  const { T } = useApp()
  const { data: st, isLoading, error } = useStunde(id)
  const zurueck = state?.zurueck ?? { to: '/lehrer', label: T('n_tab_start') }

  if (isLoading) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Laden hoehe={320} /></div></Seite>
  if (error || !st) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Leer text={T('nl_stunde_nicht_gefunden')} /></div></Seite>
  return <Formular key={st.id} st={st} zurueck={zurueck} />
}

function Formular({ st, zurueck }) {
  const navigate = useNavigate()
  const { T, lang, zeitzone, toast, confirm } = useApp()
  const neuLaden = useNeuLaden()
  const [stati, setStati] = useState(() => {
    const vorhanden = Object.fromEntries((st.anwesenheit ?? []).map(a => [a.schueler_id, a.status]))
    return Object.fromEntries(st.teilnehmer.map(p => [p.id, vorhanden[p.id] ?? 'anwesend']))
  })
  const [notizen, setNotizen] = useState(st.notizen ?? '')
  const [hausaufgaben, setHausaufgaben] = useState(st.hausaufgaben ?? '')
  const [speichert, setSpeichert] = useState(false)

  const abgesagt = st.status === 'abgesagt'
  const werte = Object.values(stati)
  const n = s => werte.filter(w => w === s).length
  const rest = [[n('zu_spaet'), 'nl_n_spaet'], [n('entschuldigt'), 'nl_n_entschuldigt'], [n('abwesend'), 'nl_n_fehlt']]
    .filter(([z]) => z).map(([z, k]) => T(k).replace('{n}', z)).join(' · ')

  function alleDa() {
    setStati(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v === 'entschuldigt' ? v : 'anwesend'])))
  }

  async function speichern() {
    setSpeichert(true)
    const payload = st.teilnehmer.map(p => ({ id: p.id, status: stati[p.id] ?? 'anwesend' }))
    const { error: e1 } = await supabase.rpc('anwesenheit_erfassen', { p_stunde_id: st.id, p_schueler: payload })
    const neueHA = hausaufgaben.trim()
    const { error: e2 } = e1 ? {} : await supabase.from('stunden')
      .update({ notizen: notizen.trim() || null, hausaufgaben: neueHA || null }).eq('id', st.id)
    setSpeichert(false)
    if (e1 || e2) { toast((e1 ?? e2).message, 'error'); return }
    if (neueHA && neueHA !== (st.hausaufgaben ?? '').trim()) {
      supabase.functions.invoke('send-email', { body: { type: 'hausaufgaben', stunde_id: st.id, hausaufgaben: neueHA } }).catch(() => {})
    }
    neuLaden('nl-stunden', 'nl-stunde', 'nl-kurs')
    toast(T('nl_gespeichert'), 'success')
    navigate(zurueck.to)
  }

  async function absagen() {
    const ok = await confirm(T('nl_stunde_absagen_frage'), { sub: T('nl_stunde_absagen_hinweis'), confirmLabel: T('nl_stunde_absagen') })
    if (!ok) return
    const { error: e } = await supabase.from('stunden').update({ status: 'abgesagt' }).eq('id', st.id)
    if (e) { toast(e.message, 'error'); return }
    supabase.functions.invoke('send-email', { body: { type: 'stunde_abgesagt', stunde_id: st.id } }).catch(() => {})
    neuLaden('nl-stunden', 'nl-stunde', 'nl-kurs')
    navigate(zurueck.to)
  }

  return (
    <Seite zurueck={zurueck} ueber={`${tagLabel(st.beginn, zeitzone, lang, T)} · ${uhrzeit(st.beginn, zeitzone, lang)}`} titel={st.unterricht?.name}>
      {abgesagt ? (
        <div style={{ marginTop: 20 }}><Leer text={T('nl_stunde_abgesagt')} /></div>
      ) : (
        <>
          {st.teilnehmer.length > 0 && (
            <>
              <div style={{ margin: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div aria-live="polite" style={{ fontSize: 17, color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--text)' }}>{T('nl_n_da').replace('{n}', n('anwesend') + n('zu_spaet'))}</strong>
                  {' · '}{rest || T('nl_alle_anwesend')}
                </div>
                <Knopf klein variante="rahmen" onClick={alleDa}>{T('nl_alle_da')}</Knopf>
              </div>

              <Gruppe style={{ marginTop: 14 }}>
                {st.teilnehmer.map((p, i) => {
                  const selbst = stati[p.id] === 'entschuldigt' && (st.anwesenheit ?? []).some(a => a.schueler_id === p.id && a.status === 'entschuldigt')
                  return (
                    <div key={p.id} style={{ padding: '12px 14px 14px', borderTop: i ? '1px solid var(--n-sep)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span aria-hidden="true" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 18, background: 'var(--bg)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, overflow: 'hidden' }}>
                          {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{p.name}</span>
                        {selbst && <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{T('nl_hat_abgesagt')}</span>}
                      </div>
                      <div role="group" aria-label={p.name} style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {STATUS.map(([wert, label, farbe]) => {
                          const aktiv = stati[p.id] === wert
                          return (
                            <button key={wert} onClick={() => setStati(prev => ({ ...prev, [p.id]: wert }))} aria-pressed={aktiv} style={{
                              minHeight: 44, borderRadius: 11, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '0 4px',
                              border: `1.5px solid ${aktiv ? farbe : 'var(--n-sep)'}`, background: aktiv ? farbe : 'var(--bg)', color: aktiv ? '#FFFFFF' : 'var(--text)',
                            }}>{T(label)}</button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </Gruppe>
            </>
          )}

          <Abschnitt titel={T('nl_was_gemacht')} style={{ marginTop: 28 }}>
            <div style={{ padding: '0 20px' }}>
              <textarea aria-label={T('nl_was_gemacht')} rows={3} value={notizen} onChange={e => setNotizen(e.target.value)}
                style={{ ...eingabeStil, resize: 'vertical', lineHeight: 1.4 }} />
            </div>
          </Abschnitt>

          <Abschnitt titel={T('nl_bis_naechstes_mal')} style={{ marginTop: 24 }}>
            <div style={{ padding: '0 20px' }}>
              <textarea aria-label={T('nl_bis_naechstes_mal')} rows={2} value={hausaufgaben} onChange={e => setHausaufgaben(e.target.value)}
                placeholder={T('nl_hausaufgaben_hinweis')} style={{ ...eingabeStil, resize: 'vertical', lineHeight: 1.4 }} />
            </div>
          </Abschnitt>

          <div style={{ margin: '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Knopf voll icon={Check} onClick={speichern} disabled={speichert} style={{ height: 56, fontSize: 18 }}>
              {st.status === 'stattgefunden' ? T('nl_aenderungen_speichern') : T('nl_stunde_abschliessen')}
            </Knopf>
            {st.status === 'geplant' && (
              <Knopf voll variante="gefahr" onClick={absagen}>{T('nl_stunde_absagen')}</Knopf>
            )}
          </div>
        </>
      )}
    </Seite>
  )
}
