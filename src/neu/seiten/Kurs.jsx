import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Music, User, MapPin, CircleCheck, CircleX, Clock, Paperclip } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Chips, Leer, Laden, LiedCover } from '../../ui'
import { useMeineStunden, useMeineLieder, useAbsage } from '../daten'
import { StundeKarte } from '../karten'
import { tagLabel, uhrzeit } from '../zeit'
import { useKurseMitLehrern, KURS_ICON } from './Kurse'
import { useBasis } from '../rolle'

const ANSICHTEN = ['termine', 'lieder', 'anwesenheit', 'dateien']

export default function NeuKurs() {
  const { id } = useParams()
  const { T, lang } = useApp()
  const basis = useBasis()
  const [params, setParams] = useSearchParams()
  const ansicht = ANSICHTEN.includes(params.get('ansicht')) ? params.get('ansicht') : 'termine'
  const { data: kurse, isLoading } = useKurseMitLehrern()
  const kurs = kurse?.find(k => k.id === id)
  const zurueck = { to: `${basis}/kurse`, label: T('my_classes') }

  if (isLoading) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Laden hoehe={200} /></div></Seite>
  if (!kurs) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Leer text={T('kurs_not_found')} /></div></Seite>

  const instrument = kurs.instrumente?.[`name_${lang}`] ?? kurs.instrumente?.name_de
  const Icon = KURS_ICON[kurs.typ] ?? Music

  return (
    <Seite titel={kurs.name} ueber={T(`n_kurstyp_${kurs.typ}`)} zurueck={zurueck}>
      <Gruppe style={{ marginTop: 20 }}>
        {kurs.lehrer.length > 0 && <Zeile icon={User} titel={kurs.lehrer.join(', ')} untertitel={T(kurs.lehrer.length > 1 ? 'n_lehrkraefte' : 'n_lehrkraft')} />}
        {kurs.raeume?.name && <><Trenner /><Zeile icon={MapPin} titel={kurs.raeume.name} untertitel={T('n_raum')} /></>}
        {instrument && <><Trenner /><Zeile icon={Icon} titel={instrument} untertitel={T('n_instrument')} /></>}
      </Gruppe>

      <div style={{ marginTop: 24 }}>
        <Chips label={T('n_ansicht')} wert={ansicht} onChange={a => setParams({ ansicht: a }, { replace: true })}
          optionen={[['termine', T('n_tab_termine')], ['lieder', T('n_tab_lieder')], ['anwesenheit', T('attendance_title')], ['dateien', T('n_dateien')]]} />
      </div>

      {ansicht === 'termine' && <KursTermine kursId={id} />}
      {ansicht === 'lieder' && <KursLieder kursId={id} />}
      {ansicht === 'anwesenheit' && <KursAnwesenheit kursId={id} />}
      {ansicht === 'dateien' && <KursDateien kursId={id} />}
    </Seite>
  )
}

function KursTermine({ kursId }) {
  const { T, lang, zeitzone } = useApp()
  const { data: stunden = [], isLoading } = useMeineStunden(60, { kursId, zurueck: 42 })
  const absage = useAbsage()
  const jetzt = Date.now()
  const kommende = stunden.filter(s => new Date(s.ende) > jetzt)
  const hausaufgabe = [...stunden].reverse().find(s => new Date(s.beginn) <= jetzt && s.hausaufgaben?.trim())

  if (isLoading) return <div style={{ marginTop: 20 }}><Laden /></div>
  return (
    <>
      {hausaufgabe && (
        <Abschnitt titel={T('n_hausaufgabe')} style={{ marginTop: 24 }}>
          <div style={{ margin: '0 20px', padding: 16, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', gap: 14 }}>
            <BookOpen aria-hidden="true" size={24} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{hausaufgabe.hausaufgaben}</div>
              <div style={{ marginTop: 6, fontSize: 15, color: 'var(--text-2)' }}>{T('n_aus_der_stunde_vom').replace('{datum}', tagLabel(hausaufgabe.beginn, zeitzone, lang, T))}</div>
            </div>
          </div>
        </Abschnitt>
      )}
      <Abschnitt titel={T('n_naechste_stunden')} style={{ marginTop: 24 }}>
        {kommende.length === 0 ? <Leer text={T('n_keine_termine')} /> : (
          <div style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {kommende.map(s => (
              <StundeKarte key={s.id} s={s} titel={tagLabel(s.beginn, zeitzone, lang, T)}
                onUmschalten={() => absage.umschalten(s)} sendet={absage.sendet === s.id} />
            ))}
          </div>
        )}
      </Abschnitt>
    </>
  )
}

function KursLieder({ kursId }) {
  const { T } = useApp()
  const basis = useBasis()
  const { data: lieder = [], isLoading } = useMeineLieder()
  const imKurs = lieder
    .map(l => ({ ...l, k: l.kurse.find(k => k.id === kursId) }))
    .filter(l => l.k && l.k.status !== 'geplant')
    .sort((a, b) => a.k.reihenfolge - b.k.reihenfolge)
  const state = { liste: imKurs.map(l => ({ id: l.stueck.id, titel: l.stueck.titel })) }

  if (isLoading) return <div style={{ marginTop: 20 }}><Laden /></div>
  return (
    <div style={{ marginTop: 20 }}>
      {imKurs.length === 0 ? <Leer text={T('n_noch_keine_lieder')} /> : (
        <Gruppe>
          {imKurs.map((l, i) => (
            <div key={l.stueck.id}>
              {i > 0 && <Trenner />}
              <Zeile bild={<LiedCover id={l.stueck.id} groesse={48} />} titel={l.stueck.titel}
                untertitel={[l.stueck.komponist, l.k.status === 'aktuell' ? T('n_wird_geprobt') : null].filter(Boolean).join(' · ') || null}
                to={`${basis}/repertoire/${l.stueck.id}`} state={state} />
            </div>
          ))}
        </Gruppe>
      )}
    </div>
  )
}

const STATUS = {
  anwesend:     { icon: CircleCheck, farbe: 'var(--success)', label: 'present' },
  zu_spaet:     { icon: Clock,       farbe: 'var(--text-2)', label: 'late' },
  entschuldigt: { icon: CircleX,     farbe: 'var(--text-2)', label: 'excused' },
  abwesend:     { icon: CircleX,     farbe: 'var(--danger)', label: 'absent' },
}

function KursAnwesenheit({ kursId }) {
  const { profil, T, lang, zeitzone } = useApp()
  const { data, isLoading } = useQuery({
    queryKey: ['n-anwesenheit', profil?.id, kursId],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data: st, error } = await supabase.from('stunden')
        .select('id, beginn, anwesenheit(status, schueler_id)')
        .eq('unterricht_id', kursId).eq('status', 'stattgefunden')
        .order('beginn', { ascending: false })
      if (error) throw error
      return (st ?? []).map(s => ({ ...s, meine: (s.anwesenheit ?? []).find(a => a.schueler_id === profil.id) ?? null }))
    },
  })

  if (isLoading) return <div style={{ marginTop: 20 }}><Laden /></div>
  const stunden = data ?? []
  if (!stunden.length) return <div style={{ marginTop: 20 }}><Leer text={T('attendance_none_held')} /></div>

  const da = stunden.filter(s => s.meine?.status === 'anwesend' || s.meine?.status === 'zu_spaet').length
  const quote = Math.round(100 * da / stunden.length)

  return (
    <>
      <div style={{ margin: '20px 20px 0', padding: 20, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', color: quote >= 80 ? 'var(--success)' : 'var(--text)' }}>{quote} %</div>
        <div style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.4 }}>{T('n_x_von_y_stunden_da').replace('{x}', da).replace('{y}', stunden.length)}</div>
      </div>
      <Gruppe style={{ marginTop: 16 }}>
        {stunden.map((s, i) => {
          const st = STATUS[s.meine?.status]
          return (
            <div key={s.id}>
              {i > 0 && <Trenner />}
              <Zeile icon={st?.icon ?? Clock} iconFarbe={st?.farbe ?? 'var(--text-3)'}
                titel={tagLabel(s.beginn, zeitzone, lang, T)} untertitel={uhrzeit(s.beginn, zeitzone, lang)}
                wert={st ? T(st.label) : T('attendance_not_recorded')} wertFarbe={st?.farbe} />
            </div>
          )
        })}
      </Gruppe>
    </>
  )
}

function KursDateien({ kursId }) {
  const { profil, T, toast, lang, zeitzone } = useApp()
  const { data: dateien = [], isLoading } = useQuery({
    queryKey: ['n-kurs-dateien', profil?.id, kursId],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('dateien').select('id, name, schueler_id, bucket_pfad, hochgeladen_am')
        .or(`unterricht_id.eq.${kursId},schueler_id.eq.${profil.id}`)
        .order('hochgeladen_am', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  async function oeffnen(d) {
    // Fenster sofort öffnen, sonst blockiert iOS das Popup nach dem await
    const fenster = window.open('', '_blank')
    const { data, error } = await supabase.storage.from(d.schueler_id ? 'schueler-dateien' : 'kurs-dateien').createSignedUrl(d.bucket_pfad, 3600)
    if (error || !data?.signedUrl) { fenster?.close(); toast(error?.message ?? T('n_fehler'), 'error'); return }
    if (fenster) fenster.location = data.signedUrl
    else window.location.href = data.signedUrl
  }

  if (isLoading) return <div style={{ marginTop: 20 }}><Laden /></div>
  return (
    <div style={{ marginTop: 20 }}>
      {dateien.length === 0 ? <Leer text={T('n_keine_kursdateien')} /> : (
        <Gruppe>
          {dateien.map((d, i) => (
            <div key={d.id}>
              {i > 0 && <Trenner />}
              <Zeile icon={Paperclip} titel={d.name}
                untertitel={`${d.schueler_id ? T('n_nur_fuer_dich') : T('n_fuer_den_kurs')} · ${tagLabel(d.hochgeladen_am, zeitzone, lang, T)}`}
                onClick={() => oeffnen(d)} />
            </div>
          ))}
        </Gruppe>
      )}
    </div>
  )
}
