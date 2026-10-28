import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, X, CalendarPlus, Trash2, BadgeCheck, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Gruppe, Trenner, Zeile, Knopf, Leer, Laden } from '../../ui'
import { useNeuLaden } from '../daten'
import { useBreit, Avatar, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TAG = 86400000

function useDemos() {
  return useQuery({
    queryKey: ['na-demos'],
    queryFn: async () => {
      const [a, d, ar] = await Promise.all([
        supabase.from('demo_anfragen').select('*').eq('status', 'ausstehend').order('erstellt_am', { ascending: false }),
        supabase.from('demo_anfragen').select('*, schulen(id, name, demo_expires_at)').eq('status', 'genehmigt').order('genehmigt_am', { ascending: false }),
        supabase.from('demo_anfragen').select('*').eq('status', 'archiviert').order('genehmigt_am', { ascending: false }),
      ])
      return { anfragen: a.data ?? [], aktiv: d.data ?? [], archiv: ar.data ?? [] }
    },
  })
}

// Edge Function legt die Demo-Schule an und verschickt die Zugangsdaten
async function genehmigen(anfrageId) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-genehmigen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ anfrage_id: anfrageId }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? res.statusText) }
}

function Detail({ a, ansicht, onAktion, beschaeftigt }) {
  const { T, lang } = useApp()
  const datum = d => d ? new Date(d).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'
  const rest = a.schulen?.demo_expires_at ? Math.ceil((new Date(a.schulen.demo_expires_at) - Date.now()) / TAG) : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar name={a.schul_name} groesse={64} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{a.schul_name}</h2>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('ni_seit').replace('{d}', datum(a.erstellt_am))}</div>
        </div>
      </div>

      {ansicht === 'anfragen' && (
        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf icon={Check} disabled={beschaeftigt} onClick={() => onAktion('genehmigen')} style={{ flex: '1 1 160px' }}>{beschaeftigt ? '…' : T('nsa_genehmigen')}</Knopf>
          <Knopf variante="sekundaer" icon={X} disabled={beschaeftigt} onClick={() => onAktion('ablehnen')} style={{ flex: '1 1 120px' }}>{T('nsa_ablehnen')}</Knopf>
        </div>
      )}
      {ansicht === 'aktiv' && (
        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf icon={CalendarPlus} disabled={beschaeftigt} onClick={() => onAktion('verlaengern')} style={{ flex: '1 1 160px' }}>{T('nsa_verlaengern')}</Knopf>
          <Knopf variante="sekundaer" icon={BadgeCheck} disabled={beschaeftigt} onClick={() => onAktion('umwandeln')} style={{ flex: '1 1 160px' }}>{T('nsa_umwandeln')}</Knopf>
        </div>
      )}
      {ansicht === 'archiv' && (
        <div style={{ marginTop: 18 }}>
          <Knopf icon={RotateCcw} disabled={beschaeftigt} onClick={() => onAktion('neu')}>{beschaeftigt ? '…' : T('nsa_neu_schalten')}</Knopf>
        </div>
      )}

      <DetailTitel>{T('nm_kontakt')}</DetailTitel>
      <DetailGruppe>
        <Info label={T('name')}>{a.name}</Info>
        <Trenner /><Info label={T('nm_email')}>{a.email}</Info>
        {a.beschreibung && <><Trenner /><Info label={T('nsa_nachricht')}>{a.beschreibung}</Info></>}
      </DetailGruppe>

      {ansicht !== 'anfragen' && <>
        <DetailTitel>{T('nsa_demo')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('nsa_genehmigt_am')}>{datum(a.genehmigt_am)}</Info>
          {a.schulen && <><Trenner /><Info label={T('nsa_demo_bis')}>{`${datum(a.schulen.demo_expires_at)}${rest != null ? ` (${T('nsa_noch_tage').replace('{n}', Math.max(rest, 0))})` : ''}`}</Info></>}
        </DetailGruppe>
      </>}

      {ansicht === 'aktiv' && a.schulen && (
        <div style={{ marginTop: 24 }}>
          <Knopf voll variante="gefahr" icon={Trash2} disabled={beschaeftigt} onClick={() => onAktion('loeschen')}>{T('nsa_demo_loeschen')}</Knopf>
        </div>
      )}
    </div>
  )
}

export default function SuperadminDemos() {
  const { T, lang, toast, confirm } = useApp()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data, isLoading } = useDemos()
  const [ansicht, setAnsicht] = useState('anfragen')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)

  const liste = data?.[ansicht] ?? []
  const gewaehlt = liste.find(a => a.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-demos', 'na-alle-schulen')
  const kurz = d => d ? new Date(d).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'short' }) : ''

  async function aktion(typ) {
    const a = gewaehlt
    const fragen = {
      genehmigen: [T('nsa_genehmigen_frage').replace('{name}', a.schul_name).replace('{email}', a.email), T('nsa_genehmigen')],
      ablehnen: [T('nsa_ablehnen_frage').replace('{name}', a.schul_name), T('nsa_ablehnen'), true],
      umwandeln: [T('nsa_umwandeln_frage').replace('{name}', a.schulen?.name ?? a.schul_name), T('nsa_umwandeln')],
      loeschen: [T('nsa_demo_loeschen_frage').replace('{name}', a.schulen?.name ?? a.schul_name), T('delete'), true],
      neu: [T('nsa_neu_schalten_frage').replace('{name}', a.schul_name).replace('{email}', a.email), T('nsa_neu_schalten')],
    }
    if (fragen[typ]) {
      const [text, label, gefaehrlich] = fragen[typ]
      if (!await confirm(text, { confirmLabel: label, dangerous: !!gefaehrlich })) return
    }
    setBeschaeftigt(true)
    try {
      if (typ === 'genehmigen') {
        await genehmigen(a.id)
        toast(T('nsa_genehmigt_ok'), 'success')
      } else if (typ === 'neu') {
        // Edge Function akzeptiert nur ausstehende Anfragen
        await supabase.from('demo_anfragen').update({ status: 'ausstehend' }).eq('id', a.id)
        try { await genehmigen(a.id) } catch (e) {
          await supabase.from('demo_anfragen').update({ status: 'archiviert' }).eq('id', a.id)
          throw e
        }
        toast(T('nsa_genehmigt_ok'), 'success')
      } else if (typ === 'ablehnen') {
        const { error } = await supabase.from('demo_anfragen').update({ status: 'abgelehnt' }).eq('id', a.id)
        if (error) throw error
      } else if (typ === 'verlaengern') {
        const basis = Math.max(Date.now(), new Date(a.schulen?.demo_expires_at ?? 0).getTime())
        const { error } = await supabase.from('schulen').update({ demo_expires_at: new Date(basis + 7 * TAG).toISOString() }).eq('id', a.schulen.id)
        if (error) throw error
        toast(T('nsa_verlaengert_ok'), 'success')
      } else if (typ === 'umwandeln') {
        const { error } = await supabase.from('schulen').update({ ist_demo: false, demo_expires_at: null }).eq('id', a.schulen.id)
        if (error) throw error
        await supabase.from('demo_anfragen').update({ status: 'archiviert' }).eq('id', a.id)
        toast(T('nsa_umgewandelt_ok'), 'success')
      } else if (typ === 'loeschen') {
        const { error } = await supabase.rpc('demo_schule_loeschen', { p_schule_id: a.schulen.id })
        if (error) throw error
        toast(T('nsa_demo_geloescht_ok'), 'success')
      }
      if (typ !== 'verlaengern') setGewaehltId(null)
      aktualisieren()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBeschaeftigt(false)
    }
  }

  const zahl = k => data?.[k]?.length ?? 0

  return (
    <Seite breit titel={T('na_demo_anfragen')}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.schul_name} blattTitel={T('na_demo_anfragen')} onSchliessen={() => setGewaehltId(null)}
        detail={gewaehlt && <Detail key={gewaehlt.id} a={gewaehlt} ansicht={ansicht} onAktion={aktion} beschaeftigt={beschaeftigt} />}
        liste={<>
          <Segment label={T('n_filter')} wert={ansicht} onChange={v => { setAnsicht(v); setGewaehltId(null) }} style={{ margin: '0 20px' }}
            optionen={[['anfragen', `${T('nsa_anfragen')} (${zahl('anfragen')})`], ['aktiv', `${T('nsa_aktiv')} (${zahl('aktiv')})`], ['archiv', T('nsa_archiv')]]} />
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={260} /> : liste.length === 0 ? <Leer text={T('nsa_keine_anfragen')} /> : (
              <Gruppe>
                {liste.map((a, i) => {
                  const rest = a.schulen?.demo_expires_at ? Math.ceil((new Date(a.schulen.demo_expires_at) - Date.now()) / TAG) : null
                  return (
                    <div key={a.id} style={{ background: breit && gewaehlt?.id === a.id ? 'var(--n-tint)' : undefined }}>
                      {i > 0 && <Trenner />}
                      <Zeile bild={<Avatar name={a.schul_name} />} titel={a.schul_name} untertitel={[a.name, a.email].filter(Boolean).join(' · ')}
                        wert={rest != null ? T('nsa_noch_tage').replace('{n}', Math.max(rest, 0)) : kurz(ansicht === 'anfragen' ? a.erstellt_am : a.genehmigt_am)}
                        wertFarbe={rest != null && rest <= 2 ? 'var(--danger)' : 'var(--text-2)'} chevron={!breit} onClick={() => setGewaehltId(a.id)} />
                    </div>
                  )
                })}
              </Gruppe>
            )}
          </div>
        </>} />
    </Seite>
  )
}
