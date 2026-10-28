import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, Clock, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { KURS_ICON } from '../seiten/Kurse'
import { useKinder, useKinderKurse, useKinderStunden } from './daten'
import { tagLabel, uhrzeit } from '../zeit'

function Avatar({ kind }) {
  return (
    <span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, overflow: 'hidden' }}>
      {kind.avatar_url ? <img src={kind.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (kind.voller_name[0] ?? '?').toUpperCase()}
    </span>
  )
}

// Reiter „Kinder“: Liste der verknüpften Kinder
export function ElternKinder() {
  const { T } = useApp()
  const { data: kinder = [], isLoading } = useKinder()
  const { data: kk = [] } = useKinderKurse()

  return (
    <Seite titel={T('ne_tab_kinder')}>
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden /> : kinder.length === 0 ? <Leer text={T('ne_keine_kinder')} /> : (
          <Gruppe>
            {kinder.map((k, i) => (
              <div key={k.id}>
                {i > 0 && <Trenner />}
                <Zeile bild={<Avatar kind={k} />} titel={k.voller_name}
                  untertitel={kk.filter(e => e.kindId === k.id).map(e => e.kurs.name).join(', ') || T('ne_keine_kurse')} to={`/eltern/kinder/${k.id}`} />
              </div>
            ))}
          </Gruppe>
        )}
      </div>
    </Seite>
  )
}

const ANWESEND = ['anwesend', 'zu_spaet']

// Ein Kind: Kurse, nächste Stunden, Hausaufgaben, Anwesenheit
export function ElternKind() {
  const { id } = useParams()
  const { T, lang, zeitzone } = useApp()
  const { data: kinder, isLoading } = useKinder()
  const { data: kk = [] } = useKinderKurse()
  const { data: stunden = [] } = useKinderStunden(30, { zurueck: 60 })
  const kind = kinder?.find(k => k.id === id)
  const kurse = kk.filter(e => e.kindId === id).map(e => e.kurs)
  const kursIds = kurse.map(k => k.id).join()

  const { data: anwesenheit } = useQuery({
    queryKey: ['ne-anwesenheit', id, kursIds],
    enabled: !!kind && kurse.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('stunden')
        .select('id, anwesenheit(status, schueler_id)')
        .in('unterricht_id', kurse.map(k => k.id)).eq('status', 'stattgefunden')
        .gte('beginn', new Date(Date.now() - 180 * 86400000).toISOString())
      if (error) throw error
      const status = (data ?? []).map(s => (s.anwesenheit ?? []).find(a => a.schueler_id === id)?.status ?? null)
      return { gesamt: status.length, da: status.filter(s => ANWESEND.includes(s)).length, entschuldigt: status.filter(s => s === 'entschuldigt').length }
    },
  })

  const zurueck = { to: '/eltern/kinder', label: T('ne_tab_kinder') }
  if (isLoading) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Laden hoehe={200} /></div></Seite>
  if (!kind) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Leer text={T('ne_kind_nicht_gefunden')} /></div></Seite>

  const jetzt = Date.now()
  const eigene = stunden.filter(s => s.kinder.some(x => x.id === id))
  const kommende = eigene.filter(s => new Date(s.ende) > jetzt).slice(0, 5)
  const hausaufgaben = eigene.filter(s => new Date(s.beginn) <= jetzt && s.hausaufgaben).reverse().slice(0, 5)
  const quote = anwesenheit?.gesamt ? Math.round(100 * anwesenheit.da / anwesenheit.gesamt) : null

  return (
    <Seite titel={kind.voller_name} zurueck={zurueck}>
      <Abschnitt titel={T('my_classes')} style={{ marginTop: 24 }}>
        {kurse.length === 0 ? <Leer text={T('ne_keine_kurse')} /> : (
          <Gruppe>
            {kurse.map((k, i) => (
              <div key={k.id}>
                {i > 0 && <Trenner />}
                <Zeile icon={KURS_ICON[k.typ]} titel={k.name} untertitel={[k.lehrer.join(', '), k.raeume?.name].filter(Boolean).join(' · ') || null} />
              </div>
            ))}
          </Gruppe>
        )}
      </Abschnitt>

      <Abschnitt titel={T('ne_naechste_stunden')}>
        {kommende.length === 0 ? <Leer text={T('n_keine_termine')} /> : (
          <Gruppe>
            {kommende.map((s, i) => {
              const status = s.kinder.find(x => x.id === id)?.status
              const abgesagt = s.status === 'abgesagt'
              return (
                <div key={s.id}>
                  {i > 0 && <Trenner />}
                  <Zeile icon={abgesagt ? CircleX : Clock} iconFarbe={abgesagt ? 'var(--danger)' : 'var(--primary)'} titel={s.unterricht?.name}
                    untertitel={[`${tagLabel(s.beginn, zeitzone, lang, T)} · ${uhrzeit(s.beginn, zeitzone, lang)}`, s.raum].filter(Boolean).join(' · ')}
                    wert={abgesagt ? T('n_faellt_aus') : status === 'entschuldigt' ? T('ne_entschuldigt') : null} wertFarbe={abgesagt ? 'var(--danger)' : undefined} />
                </div>
              )
            })}
          </Gruppe>
        )}
      </Abschnitt>

      {hausaufgaben.length > 0 && (
        <Abschnitt titel={T('ne_hausaufgaben')}>
          <Gruppe>
            {hausaufgaben.map((s, i) => (
              <div key={s.id}>
                {i > 0 && <Trenner />}
                <Zeile icon={BookOpen} iconFarbe="var(--success)" titel={s.hausaufgaben} untertitel={`${s.unterricht?.name ?? ''} · ${tagLabel(s.beginn, zeitzone, lang, T)}`} />
              </div>
            ))}
          </Gruppe>
        </Abschnitt>
      )}

      {quote != null && (
        <Abschnitt titel={T('ne_anwesenheit')}>
          <div style={{ margin: '0 20px', padding: 20, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', alignItems: 'center', gap: 18 }}>
            <CircleCheck aria-hidden="true" size={36} color={quote >= 80 ? 'var(--success)' : 'var(--text-2)'} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: quote >= 80 ? 'var(--success)' : 'var(--text)' }}>{quote} %</div>
              <div style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.4 }}>
                {T('n_x_von_y_stunden_da').replace('{x}', anwesenheit.da).replace('{y}', anwesenheit.gesamt)}
                {anwesenheit.entschuldigt > 0 && ` · ${T('ne_x_entschuldigt').replace('{n}', anwesenheit.entschuldigt)}`}
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-3)', marginTop: 2 }}>{T('ne_letzte_6_monate')}</div>
            </div>
          </div>
        </Abschnitt>
      )}
    </Seite>
  )
}
