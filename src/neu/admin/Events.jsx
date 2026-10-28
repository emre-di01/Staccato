import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Music, UserPlus, X, Globe } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Suchfeld, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt } from '../../ui'
import { useNeuLaden } from '../daten'
import { uhrzeit } from '../zeit'
import EventBlatt from '../lehrer/EventBlatt'
import { useBreit, Avatar, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const ZUSAGE_FARBE = { zugesagt: 'var(--success)', abgesagt: 'var(--danger)', offen: 'var(--text-2)' }

function useEvents() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-events', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('events')
        .select('*, raeume(name), event_teilnehmer(zusage), event_stuecke(stueck_id)')
        .eq('schule_id', schule.id).order('beginn')
      if (error) throw error
      return data ?? []
    },
  })
}

function useTeilnehmer(eventId) {
  return useQuery({
    queryKey: ['na-event-teilnehmer', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from('event_teilnehmer')
        .select('profil_id, zusage, profiles(id, voller_name, rolle, avatar_url)').eq('event_id', eventId)
      return (data ?? []).filter(t => t.profiles).sort((a, b) => a.profiles.voller_name.localeCompare(b.profiles.voller_name))
    },
  })
}

function datumZeit(ev, lang, zeitzone) {
  const tag = new Date(ev.beginn).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: zeitzone })
  const zeit = uhrzeit(ev.beginn, zeitzone, lang) + (ev.ende ? ` – ${uhrzeit(ev.ende, zeitzone, lang)}` : '')
  return `${tag}, ${zeit}`
}

// Personen einladen: Suche über alle aktiven Mitglieder der Schule
function EinladenBlatt({ ev, vorhanden, onClose, onFertig }) {
  const { T, schule, toast } = useApp()
  const [suche, setSuche] = useState('')
  const [sendet, setSendet] = useState(null)
  const { data: personen = [], isLoading } = useQuery({
    queryKey: ['na-event-personen', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => (await supabase.from('profiles').select('id, voller_name, rolle, avatar_url').eq('schule_id', schule.id).eq('aktiv', true).order('voller_name')).data ?? [],
  })
  const q = suche.trim().toLowerCase()
  const liste = personen.filter(p => !vorhanden.has(p.id) && (!q || p.voller_name.toLowerCase().includes(q)))

  async function einladen(p) {
    setSendet(p.id)
    const { error } = await supabase.from('event_teilnehmer').insert({ event_id: ev.id, profil_id: p.id })
    setSendet(null)
    if (error) { toast(error.message, 'error'); return }
    supabase.functions.invoke('send-email', { body: { type: 'event_invite', event_id: ev.id, profil_id: p.id } }).catch(() => {})
    toast(T('nv_eingeladen').replace('{name}', p.voller_name), 'success')
    onFertig()
  }

  return (
    <Blatt titel={T('nv_personen_einladen')} onClose={onClose}>
      <div style={{ margin: '0 -20px' }}>
        <Suchfeld wert={suche} onChange={setSuche} label={T('nm_suchen')} placeholder={T('nm_suchen_platzhalter')} />
        <div style={{ marginTop: 12 }}>
          {isLoading ? <Laden hoehe={200} /> : liste.length === 0 ? <Leer text={T('member_none_found')} /> : (
            <Gruppe>
              {liste.slice(0, 60).map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <Trenner />}
                  <Zeile bild={<Avatar name={p.voller_name} bild={p.avatar_url} />} titel={p.voller_name} untertitel={T(p.rolle)}
                    wert={sendet === p.id ? '…' : T('nv_einladen')} wertFarbe="var(--primary)" chevron={false} onClick={() => !sendet && einladen(p)} />
                </div>
              ))}
            </Gruppe>
          )}
        </div>
      </div>
    </Blatt>
  )
}

function Detail({ ev, onBearbeiten, onEinladen }) {
  const { T, lang, zeitzone, confirm, toast } = useApp()
  const navigate = useNavigate()
  const neuLaden = useNeuLaden()
  const { data: teilnehmer = [], isLoading } = useTeilnehmer(ev.id)
  const zaehle = z => teilnehmer.filter(t => (t.zusage ?? 'offen') === z).length

  async function entfernen(t) {
    if (!await confirm(T('nv_teilnehmer_entfernen_frage').replace('{name}', t.profiles.voller_name), { confirmLabel: T('nv_entfernen') })) return
    const { error } = await supabase.from('event_teilnehmer').delete().eq('event_id', ev.id).eq('profil_id', t.profil_id)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('na-event-teilnehmer', 'na-events', 'n-events')
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{T(`n_evt_${ev.typ}`)}</div>
      <h2 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{ev.titel}</h2>
      <div style={{ fontSize: 16, color: 'var(--text-2)', marginTop: 2 }}>{datumZeit(ev, lang, zeitzone)}</div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf icon={Pencil} onClick={onBearbeiten} style={{ flex: '1 1 140px' }}>{T('edit')}</Knopf>
        <Knopf variante="sekundaer" icon={Music} onClick={() => navigate(`/admin/events/${ev.id}/repertoire`)} style={{ flex: '1 1 140px' }}>
          {T('n_tab_lieder')}{ev.event_stuecke?.length ? ` (${ev.event_stuecke.length})` : ''}
        </Knopf>
      </div>

      {(ev.ort || ev.raeume?.name || ev.beschreibung || ev.oeffentlich) && <>
        <DetailTitel>{T('nv_details')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('event_location')}>{[ev.ort, ev.raeume?.name].filter(Boolean).join(' · ')}</Info>
          {ev.beschreibung && <><Trenner /><Info label={T('event_description')}>{ev.beschreibung}</Info></>}
          {ev.oeffentlich && <><Trenner /><Zeile icon={Globe} titel={T('nl_event_oeffentlich')} untertitel={T('nl_event_oeffentlich_hinweis')} chevron={false} /></>}
        </DetailGruppe>
      </>}

      <DetailTitel>{T('nv_teilnehmer')}</DetailTitel>
      {teilnehmer.length > 0 && (
        <div style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 8 }}>
          {T('nv_zusagen_stand').replace('{ja}', zaehle('zugesagt')).replace('{nein}', zaehle('abgesagt')).replace('{offen}', zaehle('offen'))}
        </div>
      )}
      <DetailGruppe>
        <Zeile icon={UserPlus} titel={T('nv_personen_einladen')} onClick={onEinladen} />
        {isLoading ? <div style={{ padding: 16, color: 'var(--text-2)' }}>…</div> : teilnehmer.map(t => {
          const z = t.zusage ?? 'offen'
          return (
            <div key={t.profil_id}>
              <Trenner />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 8px 16px', minHeight: 56 }}>
                <Avatar name={t.profiles.voller_name} bild={t.profiles.avatar_url} groesse={36} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 17, overflowWrap: 'anywhere' }}>{t.profiles.voller_name}</span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: ZUSAGE_FARBE[z] }}>{T(z === 'offen' ? 'nv_zusage_offen' : z === 'zugesagt' ? 'n_zugesagt' : 'n_abgesagt')}</span>
                </span>
                <button onClick={() => entfernen(t)} aria-label={`${T('nv_entfernen')}: ${t.profiles.voller_name}`} style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
            </div>
          )
        })}
      </DetailGruppe>
    </div>
  )
}

export default function AdminEvents() {
  const { T, lang, zeitzone } = useApp()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data: events = [], isLoading } = useEvents()
  const [zeitraum, setZeitraum] = useState('kommend')
  const [suche, setSuche] = useState('')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [blatt, setBlatt] = useState(null)   // null | 'neu' | 'einladen' | event
  const { data: teilnehmer = [] } = useTeilnehmer(blatt === 'einladen' ? gewaehltId : null)

  const jetzt = Date.now()
  const q = suche.trim().toLowerCase()
  const liste = events
    .filter(ev => (zeitraum === 'kommend') === (new Date(ev.ende ?? ev.beginn) >= jetzt))
    .filter(ev => !q || ev.titel.toLowerCase().includes(q))
  if (zeitraum === 'vergangen') liste.reverse()
  const gewaehlt = events.find(e => e.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-events', 'na-event-teilnehmer', 'n-events', 'na-start')

  return (
    <Seite breit titel={T('events')} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setBlatt('neu')}>{T('nv_neu')}</Knopf>}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.titel} blattTitel={T('events')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!blatt}
        detail={gewaehlt && <Detail key={gewaehlt.id} ev={gewaehlt} onBearbeiten={() => setBlatt(gewaehlt)}
          onEinladen={() => { setGewaehltId(gewaehlt.id); setBlatt('einladen') }} />}
        liste={<>
          <Segment label={T('n_filter')} wert={zeitraum} onChange={v => { setZeitraum(v); setGewaehltId(null) }} style={{ margin: '0 20px' }}
            optionen={[['kommend', T('nv_kommend')], ['vergangen', T('nv_vergangen')]]} />
          <div style={{ marginTop: 12 }}><Suchfeld wert={suche} onChange={setSuche} label={T('nv_events_suchen')} placeholder={T('nv_titel')} /></div>
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={260} /> : liste.length === 0 ? <Leer text={T('n_keine_termine')} /> : (
              <Gruppe>
                {liste.map((ev, i) => {
                  const ja = (ev.event_teilnehmer ?? []).filter(t => t.zusage === 'zugesagt').length
                  return (
                    <div key={ev.id} style={{ background: breit && gewaehlt?.id === ev.id ? 'var(--n-tint)' : undefined }}>
                      {i > 0 && <Trenner />}
                      <Zeile titel={ev.titel} chevron={!breit} onClick={() => setGewaehltId(ev.id)}
                        untertitel={[T(`n_evt_${ev.typ}`), datumZeit(ev, lang, zeitzone)].join(' · ')}
                        wert={ev.event_teilnehmer?.length ? T('nv_x_zusagen').replace('{n}', ja) : null} />
                    </div>
                  )
                })}
              </Gruppe>
            )}
          </div>
        </>} />

      {(blatt === 'neu' || (blatt && typeof blatt === 'object')) && (
        <EventBlatt ev={blatt === 'neu' ? null : blatt} onClose={() => setBlatt(null)}
          onFertig={() => { setBlatt(null); aktualisieren() }} />
      )}
      {blatt === 'einladen' && gewaehlt && (
        <EinladenBlatt ev={gewaehlt} vorhanden={new Set(teilnehmer.map(t => t.profil_id))} onClose={() => setBlatt(null)}
          onFertig={() => neuLaden('na-event-teilnehmer', 'na-events', 'n-events')} />
      )}
    </Seite>
  )
}
