import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, GraduationCap, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Suchfeld, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, eingabeStil } from '../../ui'
import { InteressentBlatt, KonvertierenBlatt } from './InteressentBlaetter'
import { useNeuLaden } from '../daten'
import { useBreit, Avatar, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const PIPELINE = ['interessent', 'kontaktiert', 'probe', 'angebot']
const FARBE = { interessent: '#4338CA', kontaktiert: '#7C3AED', probe: '#A16207', angebot: '#15803D', verloren: '#B91C1C' }

function useInteressenten() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-interessenten', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('interessenten')
        .select('*, instrumente(name_de, name_en, name_tr, icon), profiles!interessenten_wunsch_lehrer_fkey(voller_name)')
        .eq('schule_id', schule.id).order('angemeldet_am', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function useVerlauf(id) {
  return useQuery({
    queryKey: ['na-interessent-verlauf', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('interessenten_verlauf').select('*, profiles(voller_name)')
        .eq('interessent_id', id).order('erstellt_am', { ascending: false })
      return data ?? []
    },
  })
}

function Detail({ it, onAktion, onStatus }) {
  const { T, lang, schule, toast } = useApp()
  const neuLaden = useNeuLaden()
  const { data: verlauf = [], isLoading } = useVerlauf(it.id)
  const [notiz, setNotiz] = useState('')
  const [sendet, setSendet] = useState(false)
  const loc = LOCALE[lang] ?? 'de-DE'
  const datum = (d, zeit) => new Date(d).toLocaleDateString(loc, zeit ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long', year: 'numeric' })
  const instrument = it.instrumente ? (it.instrumente[`name_${lang}`] ?? it.instrumente.name_de) : null

  async function notizSpeichern() {
    if (!notiz.trim()) return
    setSendet(true)
    const { error } = await supabase.from('interessenten_verlauf').insert({ interessent_id: it.id, schule_id: schule.id, typ: 'notiz', inhalt: notiz.trim() })
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    setNotiz('')
    neuLaden('na-interessent-verlauf')
  }

  function verlaufText(e) {
    const st = v => T(`interessent_status_${v}`)
    switch (e.typ) {
      case 'erstellt': return T('interessent_verlauf_erstellt')
      case 'status_geaendert': return `${T('interessent_verlauf_status')}: ${st(e.alt_wert)} → ${st(e.neu_wert)}`
      case 'probe_termin': return `${T('interessent_verlauf_probe')}: ${datum(e.neu_wert, true)}`
      case 'notiz': return e.inhalt
      case 'bearbeitet': return T('interessent_verlauf_bearbeitet')
      default: return e.typ
    }
  }

  const verloren = it.status === 'verloren'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar name={it.voller_name} groesse={64} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{it.voller_name}</h2>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('ni_seit').replace('{d}', datum(it.angemeldet_am))}</div>
        </div>
      </div>

      <DetailTitel>{T('status')}</DetailTitel>
      <div role="group" aria-label={T('status')} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {PIPELINE.map((st, i) => {
          const aktiv = it.status === st
          const erreicht = !verloren && PIPELINE.indexOf(it.status) >= i
          return (
            <button key={st} onClick={() => onStatus(it, st)} aria-pressed={aktiv} style={{
              minHeight: 48, borderRadius: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '0 10px',
              border: `1.5px solid ${aktiv ? FARBE[st] : 'var(--n-sep)'}`, background: aktiv ? FARBE[st] : 'var(--bg)',
              color: aktiv ? '#FFFFFF' : erreicht ? FARBE[st] : 'var(--text)',
            }}>{i + 1}. {T(`interessent_status_${st}`)}</button>
          )
        })}
      </div>
      <button onClick={() => onStatus(it, verloren ? 'interessent' : 'verloren')} style={{ marginTop: 8, minHeight: 44, padding: '0 4px', border: 'none', background: 'none', color: verloren ? 'var(--primary)' : 'var(--danger)', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
        {verloren ? T('ni_wieder_aufnehmen') : T('ni_als_verloren')}
      </button>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf icon={GraduationCap} onClick={() => onAktion('konvertieren')} style={{ flex: '1 1 160px' }}>{T('ni_zum_mitglied')}</Knopf>
        <Knopf variante="sekundaer" icon={Pencil} onClick={() => onAktion('bearbeiten')} style={{ flex: '1 1 120px' }}>{T('edit')}</Knopf>
      </div>

      <DetailTitel>{T('nm_kontakt')}</DetailTitel>
      <DetailGruppe>
        <Info label={T('nm_email')}>{it.email}</Info>
        {it.telefon && <><Trenner /><Info label={T('profile_phone')}>{it.telefon}</Info></>}
        {it.geburtsdatum && <><Trenner /><Info label={T('profile_birthday')}>{datum(it.geburtsdatum)}</Info></>}
        {!it.email && !it.telefon && <Info label={T('nm_email')}>–</Info>}
      </DetailGruppe>

      {(instrument || it.profiles || it.probe_datum) && <>
        <DetailTitel>{T('ni_wunsch')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('instrument')}>{instrument}</Info>
          {it.profiles && <><Trenner /><Info label={T('interessent_wunsch_lehrer')}>{it.profiles.voller_name}</Info></>}
          {it.probe_datum && <><Trenner /><Info label={T('interessent_probe_termin')}>{datum(it.probe_datum, true)}</Info></>}
        </DetailGruppe>
      </>}

      {it.notizen && <>
        <DetailTitel>{T('member_internal_notes')}</DetailTitel>
        <DetailGruppe><Info label={T('nm_nur_verwaltung')}>{it.notizen}</Info></DetailGruppe>
      </>}

      <DetailTitel>{T('ni_verlauf')}</DetailTitel>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={notiz} onChange={e => setNotiz(e.target.value)} onKeyDown={e => e.key === 'Enter' && notizSpeichern()}
          placeholder={T('interessent_notiz_placeholder')} aria-label={T('interessent_notiz_placeholder')} style={{ ...eingabeStil, flex: 1, minWidth: 0 }} />
        <Knopf onClick={notizSpeichern} disabled={sendet || !notiz.trim()}>{T('ni_notiz')}</Knopf>
      </div>
      <div style={{ marginTop: 12 }}>
        {isLoading ? <div style={{ color: 'var(--text-2)' }}>…</div> : verlauf.length === 0 ? (
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('interessent_verlauf_leer')}</div>
        ) : (
          <DetailGruppe>
            {verlauf.map((e, i) => (
              <div key={e.id}>
                {i > 0 && <Trenner />}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 16, overflowWrap: 'anywhere' }}>{verlaufText(e)}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 2 }}>{[datum(e.erstellt_am, true), e.profiles?.voller_name].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
          </DetailGruppe>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={() => onAktion('loeschen')}>{T('ni_loeschen')}</Knopf>
      </div>
    </div>
  )
}

export default function AdminInteressenten() {
  const { T, lang, toast, confirm } = useApp()
  const navigate = useNavigate()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data: alle = [], isLoading } = useInteressenten()
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('offen')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [modal, setModal] = useState(null)

  const q = suche.trim().toLowerCase()
  const liste = alle.filter(i =>
    (filter === 'offen' ? i.status !== 'verloren' : filter === 'alle' || i.status === filter) &&
    (!q || [i.voller_name, i.email, i.telefon].some(v => v?.toLowerCase().includes(q))),
  )
  const gewaehlt = alle.find(i => i.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-interessenten', 'na-interessent-verlauf', 'na-start')
  const anzahl = st => alle.filter(i => i.status === st).length

  const chips = [
    ['offen', `${T('ni_offen')} (${alle.filter(i => i.status !== 'verloren').length})`],
    ...PIPELINE.filter(st => anzahl(st) > 0).map(st => [st, `${T(`interessent_status_${st}`)} (${anzahl(st)})`]),
    ...(anzahl('verloren') ? [['verloren', `${T('interessent_status_verloren')} (${anzahl('verloren')})`]] : []),
  ]

  async function statusSetzen(it, status) {
    if (it.status === status) return
    const { error } = await supabase.from('interessenten').update({ status }).eq('id', it.id)
    if (error) { toast(error.message, 'error'); return }
    aktualisieren()
  }

  async function loeschen(it) {
    if (!await confirm(T('ni_loeschen_frage').replace('{name}', it.voller_name), { confirmLabel: T('delete') })) return
    const { error } = await supabase.from('interessenten').delete().eq('id', it.id)
    if (error) { toast(error.message, 'error'); return }
    setGewaehltId(null)
    aktualisieren()
  }

  function aktion(typ) {
    if (typ === 'loeschen') loeschen(gewaehlt)
    else setModal({ typ, it: gewaehlt })
  }

  const unter = i => {
    const instrument = i.instrumente ? (i.instrumente[`name_${lang}`] ?? i.instrumente.name_de) : null
    const probe = i.probe_datum && new Date(i.probe_datum) > Date.now()
      ? T('ni_probe_am').replace('{d}', new Date(i.probe_datum).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'short' })) : null
    return [instrument, probe ?? i.email].filter(Boolean).join(' · ')
  }

  return (
    <Seite breit titel={T('prospects')} rechts={
      <Knopf klein variante="tint" icon={Plus} onClick={() => setModal({ typ: 'bearbeiten', it: null })}>{T('ni_neu')}</Knopf>
    }>
      <Segment label={T('na_tab_mitglieder')} wert="interessenten" onChange={v => v === 'mitglieder' && navigate('/admin/mitglieder')}
        optionen={[['mitglieder', T('members')], ['interessenten', T('prospects')]]} style={{ margin: '16px 20px 0', maxWidth: 420 }} />

      <ListeDetail breit={breit} detailLabel={gewaehlt?.voller_name} blattTitel={T('prospects')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!modal}
        detail={gewaehlt && <Detail key={gewaehlt.id} it={gewaehlt} onAktion={aktion} onStatus={statusSetzen} />}
        liste={<>
          <Suchfeld wert={suche} onChange={setSuche} label={T('ni_suchen')} placeholder={T('nm_suchen_platzhalter')} />
          <div style={{ marginTop: 12 }}><Chips label={T('status')} optionen={chips} wert={filter} onChange={setFilter} /></div>
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={300} /> : liste.length === 0 ? <Leer text={T('interessent_none_found')} /> : (
              <Gruppe>
                {liste.map((i, n) => (
                  <div key={i.id} style={{ background: breit && gewaehlt?.id === i.id ? 'var(--n-tint)' : undefined }}>
                    {n > 0 && <Trenner />}
                    <Zeile bild={<Avatar name={i.voller_name} />} titel={i.voller_name} untertitel={unter(i)} chevron={!breit}
                      wert={T(`interessent_status_${i.status}`)} wertFarbe={FARBE[i.status]} onClick={() => setGewaehltId(i.id)} />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>
        </>} />

      {modal?.typ === 'bearbeiten' && <InteressentBlatt item={modal.it} onClose={() => setModal(null)} onErfolg={aktualisieren} />}
      {modal?.typ === 'konvertieren' && <KonvertierenBlatt item={modal.it} onClose={() => setModal(null)} onErfolg={() => { setGewaehltId(null); neuLaden('na-mitglieder'); aktualisieren() }} />}
    </Seite>
  )
}
