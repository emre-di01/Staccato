import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useBasis, useSchulweit } from '../rolle'
import { Seite, Gruppe, Trenner, Zeile, Laden, Knopf } from '../../ui'
import { useLehrerKurse, istOffen } from '../lehrerDaten'
import { schulZeitZuIso, tagKey, uhrzeit } from '../zeit'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TAG = 86400000

// 'YYYY-MM-DD' ± n Tage (reine Kalenderrechnung, ohne Zeitzone)
function plusTage(key, n) {
  return new Date(Date.parse(key + 'T00:00:00Z') + n * TAG).toISOString().slice(0, 10)
}
function montagVon(key) {
  const wt = (new Date(key + 'T00:00:00Z').getUTCDay() + 6) % 7
  return plusTage(key, -wt)
}
function format(key, lang, opt) {
  return new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { ...opt, timeZone: 'UTC' }).format(new Date(key + 'T12:00:00Z'))
}

// Wochenansicht der Lehrkraft: Stunden der eigenen Kurse und Veranstaltungen, wochenweise blätterbar
export default function LehrerWoche() {
  const { profil, schule, T, lang, zeitzone } = useApp()
  const basis = useBasis()
  const schulweit = useSchulweit()
  const heute = tagKey(new Date().toISOString(), zeitzone)
  const [montag, setMontag] = useState(() => montagVon(heute))
  const { data: kurse } = useLehrerKurse()

  const { data, isLoading } = useQuery({
    queryKey: ['nl-woche', profil?.id, schule?.id, schulweit, montag, kurse?.length],
    enabled: !!profil?.id && !!kurse,
    queryFn: async () => {
      const von = schulZeitZuIso(montag, '00:00', zeitzone)
      const bis = schulZeitZuIso(plusTage(montag, 7), '00:00', zeitzone)
      const ids = kurse.map(k => k.id)
      const [st, ev] = await Promise.all([
        ids.length
          ? supabase.from('stunden').select('id, beginn, ende, status, unterricht(name, raeume(name)), raeume(name), anwesenheit(status)')
              .in('unterricht_id', ids).gte('beginn', von).lt('beginn', bis).order('beginn')
          : { data: [] },
        supabase.from('events').select('id, titel, typ, beginn, ende, ort, raeume(name)').eq('schule_id', schule.id)
          .gte('beginn', von).lt('beginn', bis).order('beginn'),
      ])
      return [
        ...(st.data ?? []).map(s => ({ art: 'stunde', ...s })),
        ...(ev.data ?? []).map(e => ({ art: 'event', ...e })),
      ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))
    },
  })

  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i))
  const proTag = Object.fromEntries(tage.map(t => [t, []]))
  for (const e of data ?? []) proTag[tagKey(e.beginn, zeitzone)]?.push(e)

  const istDieseWoche = montag === montagVon(heute)
  const titel = `${format(montag, lang, { day: 'numeric', month: 'short' })} – ${format(plusTage(montag, 6), lang, { day: 'numeric', month: 'short', year: 'numeric' })}`
  const hierher = { zurueck: { to: schulweit ? '/admin/woche' : '/lehrer/stundenplan', label: T('nl_wochenansicht') } }

  function status(s) {
    if (s.status === 'abgesagt') return [T('n_faellt_aus'), 'var(--danger)']
    if (s.status === 'stattgefunden') return [T('nl_erledigt'), 'var(--success)']
    if (istOffen(s)) return [T('nl_anwesenheit_fehlt'), 'var(--primary)']
    const ab = (s.anwesenheit ?? []).filter(a => a.status === 'entschuldigt').length
    return ab ? [T('nl_haben_abgesagt').replace('{n}', ab), 'var(--text-2)'] : [null, null]
  }

  const pfeil = { width: 44, height: 44, borderRadius: 22, border: 'none', background: 'var(--n-fill)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  return (
    <Seite zurueck={{ to: schulweit ? '/admin/stundenplan' : '/lehrer/anwesenheit', label: T('n_tab_termine') }} titel={T('nl_wochenansicht')}>
      <div style={{ margin: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setMontag(m => plusTage(m, -7))} aria-label={T('nl_woche_vorher')} style={pfeil}><ChevronLeft aria-hidden="true" size={22} /></button>
        <div aria-live="polite" style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 17, fontWeight: 700 }}>{titel}</div>
        <button onClick={() => setMontag(m => plusTage(m, 7))} aria-label={T('nl_woche_nachher')} style={pfeil}><ChevronRight aria-hidden="true" size={22} /></button>
      </div>
      {!istDieseWoche && (
        <div style={{ margin: '10px 20px 0', display: 'flex', justifyContent: 'center' }}>
          <Knopf klein variante="tint" onClick={() => setMontag(montagVon(heute))}>{T('n_diese_woche')}</Knopf>
        </div>
      )}

      {isLoading || !data ? <div style={{ marginTop: 24 }}><Laden hoehe={300} /></div> : tage.map(t => {
        const eintraege = proTag[t]
        const istHeute = t === heute
        return (
          <section key={t} style={{ marginTop: 24 }}>
            <h2 style={{ margin: '0 20px 8px', fontSize: 18, fontWeight: 800, color: istHeute ? 'var(--primary)' : 'var(--text)' }}>
              {istHeute ? `${T('n_heute')} · ` : ''}{format(t, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            {eintraege.length === 0 ? (
              <div style={{ margin: '0 20px', fontSize: 16, color: 'var(--text-3)' }}>{T('nl_keine_termine_tag')}</div>
            ) : (
              <Gruppe>
                {eintraege.map((e, i) => {
                  const zeit = (
                    <span style={{ width: 52, flexShrink: 0, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: e.art === 'event' ? '#2563EB' : 'var(--text)' }}>
                      {uhrzeit(e.beginn, zeitzone, lang)}
                    </span>
                  )
                  const bis = e.ende ? `${T('nl_bis')} ${uhrzeit(e.ende, zeitzone, lang)}` : null
                  if (e.art === 'event') {
                    return (
                      <div key={'e' + e.id}>
                        {i > 0 && <Trenner />}
                        <Zeile bild={zeit} titel={e.titel} untertitel={[T(`n_evt_${e.typ}`), bis, e.ort || e.raeume?.name].filter(Boolean).join(' · ')} />
                      </div>
                    )
                  }
                  const [text, farbe] = status(e)
                  return (
                    <div key={e.id}>
                      {i > 0 && <Trenner />}
                      <Zeile bild={zeit} titel={e.unterricht?.name} to={`${basis}/stunde/${e.id}`} state={hierher}
                        untertitel={[bis, e.raeume?.name ?? e.unterricht?.raeume?.name].filter(Boolean).join(' · ')}
                        wert={text} wertFarbe={farbe} />
                    </div>
                  )
                })}
              </Gruppe>
            )}
          </section>
        )
      })}
    </Seite>
  )
}
