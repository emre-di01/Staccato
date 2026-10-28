import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, DoorOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, Feld, SchalterZeile, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { schulZeitZuIso, tagKey, uhrzeit, plusTage, montagVon, kalenderFormat } from '../zeit'
import { useBreit, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

export const FARBEN = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6']

function useRaeume() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-raeume', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('raeume').select('*').eq('schule_id', schule.id).order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

// Stunden und Veranstaltungen eines Raums in einer Woche
function useBelegung(raumId, montag) {
  const { zeitzone } = useApp()
  return useQuery({
    queryKey: ['na-raum-belegung', raumId, montag],
    enabled: !!raumId,
    queryFn: async () => {
      const von = schulZeitZuIso(montag, '00:00', zeitzone)
      const bis = schulZeitZuIso(plusTage(montag, 7), '00:00', zeitzone)
      const [st, ev] = await Promise.all([
        supabase.from('stunden').select('id, beginn, ende, status, unterricht(name)')
          .eq('raum_id', raumId).neq('status', 'abgesagt').gte('beginn', von).lt('beginn', bis).order('beginn'),
        supabase.from('events').select('id, titel, beginn, ende').eq('raum_id', raumId).gte('beginn', von).lt('beginn', bis).order('beginn'),
      ])
      return [
        ...(st.data ?? []).map(s => ({ id: s.id, titel: s.unterricht?.name, beginn: s.beginn, ende: s.ende })),
        ...(ev.data ?? []).map(e => ({ id: 'e' + e.id, titel: e.titel, beginn: e.beginn, ende: e.ende, event: true })),
      ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))
    },
  })
}

function Farbpunkt({ farbe, groesse = 14 }) {
  return <span aria-hidden="true" style={{ width: groesse, height: groesse, borderRadius: groesse / 2, background: farbe ?? FARBEN[0], flexShrink: 0, display: 'inline-block' }} />
}

function Belegung({ raum }) {
  const { T, lang, zeitzone } = useApp()
  const heute = tagKey(new Date().toISOString(), zeitzone)
  const [montag, setMontag] = useState(() => montagVon(heute))
  const { data = [], isLoading } = useBelegung(raum.id, montag)
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i))
  const belegt = tage.map(t => [t, data.filter(e => tagKey(e.beginn, zeitzone) === t)]).filter(([, l]) => l.length)
  const pfeil = { width: 44, height: 44, borderRadius: 22, border: 'none', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  return (
    <>
      <DetailTitel>{T('nv_belegung')}</DetailTitel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setMontag(m => plusTage(m, -7))} aria-label={T('nl_woche_vorher')} style={pfeil}><ChevronLeft aria-hidden="true" size={22} /></button>
        <div aria-live="polite" style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
          {kalenderFormat(montag, lang, { day: 'numeric', month: 'short' })} – {kalenderFormat(plusTage(montag, 6), lang, { day: 'numeric', month: 'short' })}
        </div>
        <button onClick={() => setMontag(m => plusTage(m, 7))} aria-label={T('nl_woche_nachher')} style={pfeil}><ChevronRight aria-hidden="true" size={22} /></button>
      </div>
      {isLoading ? <Laden hoehe={120} /> : belegt.length === 0 ? (
        <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('nv_raum_frei')}</div>
      ) : belegt.map(([t, liste]) => (
        <div key={t} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: t === heute ? 'var(--primary)' : 'var(--text-2)' }}>
            {kalenderFormat(t, lang, { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <DetailGruppe>
            {liste.map((e, i) => (
              <div key={e.id}>
                {i > 0 && <Trenner />}
                <div style={{ padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: e.event ? '#2563EB' : 'var(--text)' }}>
                    {uhrzeit(e.beginn, zeitzone, lang)}{e.ende ? `–${uhrzeit(e.ende, zeitzone, lang)}` : ''}
                  </span>
                  <span style={{ fontSize: 16, overflowWrap: 'anywhere' }}>{e.titel}</span>
                </div>
              </div>
            ))}
          </DetailGruppe>
        </div>
      ))}
    </>
  )
}

function Detail({ raum, onBearbeiten, onLoeschen }) {
  const { T } = useApp()
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 18, background: raum.farbe ?? FARBEN[0], color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <DoorOpen size={30} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{raum.name}</h2>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
            {T('nv_personen_max').replace('{n}', raum.kapazitaet ?? 1)}
            {!raum.aktiv && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {T('inactive')}</span>}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf icon={Pencil} onClick={onBearbeiten} style={{ flex: '1 1 140px' }}>{T('edit')}</Knopf>
      </div>
      {(raum.ausstattung?.length > 0 || raum.notizen) && <>
        <DetailTitel>{T('nv_details')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('nv_ausstattung')}>{raum.ausstattung?.join(', ')}</Info>
          {raum.ausstattung?.length > 0 && raum.notizen && <Trenner />}
          <Info label={T('notes')}>{raum.notizen}</Info>
        </DetailGruppe>
      </>}
      <Belegung raum={raum} />
      <div style={{ marginTop: 24 }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={onLoeschen}>{T('nv_raum_loeschen')}</Knopf>
      </div>
    </div>
  )
}

function RaumBlatt({ raum, onClose, onFertig }) {
  const { T, schule, toast } = useApp()
  const istNeu = !raum?.id
  const [form, setForm] = useState({
    name: raum?.name ?? '', kapazitaet: raum?.kapazitaet ?? 1, ausstattung: raum?.ausstattung?.join(', ') ?? '',
    farbe: raum?.farbe ?? FARBEN[0], notizen: raum?.notizen ?? '', aktiv: raum?.aktiv ?? true,
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function speichern() {
    if (!form.name.trim()) { toast(T('nv_name_pflicht'), 'error'); return }
    setSendet(true)
    const daten = {
      name: form.name.trim(), kapazitaet: parseInt(form.kapazitaet) || 1, farbe: form.farbe, notizen: form.notizen.trim() || null, aktiv: form.aktiv,
      ausstattung: form.ausstattung.split(',').map(x => x.trim()).filter(Boolean),
    }
    const { error } = istNeu
      ? await supabase.from('raeume').insert({ ...daten, schule_id: schule.id })
      : await supabase.from('raeume').update(daten).eq('id', raum.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nl_gespeichert'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={istNeu ? T('nv_neuer_raum') : raum.name} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('name')}>
          <input value={form.name} onChange={e => setze('name', e.target.value)} placeholder={T('nv_raum_beispiel')} style={eingabeStil} />
        </Feld>
        <Feld label={T('nv_kapazitaet')}>
          <input type="number" inputMode="numeric" min={1} value={form.kapazitaet} onChange={e => setze('kapazitaet', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('nv_ausstattung')} hinweis={T('nv_ausstattung_hinweis')}>
          <input value={form.ausstattung} onChange={e => setze('ausstattung', e.target.value)} style={eingabeStil} />
        </Feld>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{T('nv_farbe')}</div>
          <div role="radiogroup" aria-label={T('nv_farbe')} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FARBEN.map(f => (
              <button key={f} role="radio" aria-checked={form.farbe === f} aria-label={f} onClick={() => setze('farbe', f)}
                style={{ width: 44, height: 44, borderRadius: 22, background: f, cursor: 'pointer', border: `3px solid ${form.farbe === f ? 'var(--text)' : 'transparent'}` }} />
            ))}
          </div>
        </div>
        <Feld label={T('notes')}>
          <textarea rows={3} value={form.notizen} onChange={e => setze('notizen', e.target.value)} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>
        {!istNeu && (
          <Gruppe style={{ margin: 0 }}>
            <SchalterZeile titel={T('active')} untertitel={T('nv_raum_aktiv_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
          </Gruppe>
        )}
        <Knopf voll onClick={speichern} disabled={sendet}>{istNeu ? T('nv_raum_anlegen') : T('save')}</Knopf>
      </div>
    </Blatt>
  )
}

export default function AdminRaeume() {
  const { T, toast, confirm } = useApp()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data: raeume = [], isLoading } = useRaeume()
  const [filter, setFilter] = useState('aktiv')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [blatt, setBlatt] = useState(null)   // null | 'neu' | raum

  const liste = raeume.filter(r => filter === 'alle' || (filter === 'aktiv') === !!r.aktiv)
  const gewaehlt = raeume.find(r => r.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-raeume', 'na-raum-belegung', 'nl-kurs-optionen')

  async function loeschen(raum) {
    if (!await confirm(T('nv_loeschen_frage').replace('{name}', raum.name), { confirmLabel: T('delete') })) return
    const { error } = await supabase.from('raeume').delete().eq('id', raum.id)
    if (error) { toast(T('nv_raum_loeschen_fehler'), 'error'); return }
    setGewaehltId(null)
    aktualisieren()
  }

  return (
    <Seite breit titel={T('rooms')} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setBlatt('neu')}>{T('nv_neu')}</Knopf>}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.name} blattTitel={T('rooms')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!blatt}
        detail={gewaehlt && <Detail key={gewaehlt.id} raum={gewaehlt} onBearbeiten={() => setBlatt(gewaehlt)} onLoeschen={() => loeschen(gewaehlt)} />}
        liste={<>
          <Chips label={T('status')} optionen={[['aktiv', T('active')], ['inaktiv', T('inactive')], ['alle', T('n_alle')]]} wert={filter} onChange={setFilter} />
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={240} /> : liste.length === 0 ? <Leer text={T('nv_keine_raeume')} /> : (
              <Gruppe>
                {liste.map((r, i) => (
                  <div key={r.id} style={{ background: breit && gewaehlt?.id === r.id ? 'var(--n-tint)' : undefined }}>
                    {i > 0 && <Trenner />}
                    <Zeile bild={<Farbpunkt farbe={r.farbe} />} titel={r.name} chevron={!breit}
                      untertitel={[T('nv_personen_max').replace('{n}', r.kapazitaet ?? 1), r.ausstattung?.join(', ')].filter(Boolean).join(' · ')}
                      wert={r.aktiv ? null : T('inactive')} onClick={() => setGewaehltId(r.id)} />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>
        </>} />

      {blatt && <RaumBlatt raum={blatt === 'neu' ? null : blatt} onClose={() => setBlatt(null)} onFertig={() => { setBlatt(null); aktualisieren() }} />}
    </Seite>
  )
}
