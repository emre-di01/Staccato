import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Music, Trash2, PenSquare, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Gruppe, Trenner, Leer, Laden, Knopf, Segment, Blatt, Feld, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { useBasis } from '../rolle'
import { useLehrerKurse } from '../lehrerDaten'
import { uhrzeit, tagLabel, tagKey } from '../zeit'

// Posteingang; Lehrer können zusätzlich schreiben und Gesendetes sehen.
// Die geöffnete Nachricht steht in ?id=…, damit „Zurück“ im Browser bzw. auf dem Handy zur Liste führt.
// ?neu=kurs&kurs=<id> bzw. ?neu=direkt&an=<profilId> öffnet direkt das Schreiben-Blatt.
export default function NeuNachrichten() {
  const { profil, rolle, T, lang, zeitzone, toast, confirm } = useApp()
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const neuLaden = useNeuLaden()
  const basis = useBasis()
  const offenId = params.get('id')
  const kannSenden = ['lehrer', 'admin', 'superadmin'].includes(rolle)
  const [ordner, setOrdner] = useState('eingang')
  const schreiben = kannSenden && params.get('neu') ? { typ: params.get('neu'), kurs: params.get('kurs'), an: params.get('an') } : null

  const queryKey = ['n-nachrichten', profil?.id]
  const { data: nachrichten = [], isLoading } = useQuery({
    queryKey,
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('nachrichten')
        .select('id, typ, betreff, inhalt, gesendet_am, gesendet_von, empfaenger_id, sender:profiles!nachrichten_gesendet_von_fkey(voller_name, avatar_url), empfaenger:profiles!nachrichten_empfaenger_id_fkey(voller_name, avatar_url), kurs:unterricht(name), gelesen:nachricht_gelesen(nachricht_id), geloescht:nachricht_geloescht(nachricht_id)')
        .order('gesendet_am', { ascending: false })
      if (error) throw error
      return (data ?? []).filter(n => !n.geloescht?.length)
    },
  })

  useEffect(() => {
    const ch = supabase.channel('n_nachrichten')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachrichten' }, () => neuLaden('n-nachrichten', 'n-ungelesen'))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const eingang  = nachrichten.filter(n => n.gesendet_von !== profil?.id || n.empfaenger_id === profil?.id)
  const gesendet = nachrichten.filter(n => n.gesendet_von === profil?.id)
  const offen = offenId ? nachrichten.find(n => n.id === offenId) : null
  useEffect(() => { window.scrollTo(0, 0) }, [offenId])

  // Beim Öffnen als gelesen markieren
  useEffect(() => {
    if (!offen || offen.gelesen?.length || offen.gesendet_von === profil.id) return
    supabase.from('nachricht_gelesen').upsert({ nachricht_id: offen.id, user_id: profil.id }).then(({ error }) => {
      if (error) return
      qc.setQueryData(queryKey, alt => alt?.map(n => n.id === offen.id ? { ...n, gelesen: [{ nachricht_id: n.id }] } : n))
      neuLaden('n-ungelesen')
      window.dispatchEvent(new CustomEvent('staccato:nachricht_gelesen'))
    })
  }, [offen?.id])

  async function loeschen(n) {
    const ok = await confirm(T('n_nachricht_loeschen_frage'), { confirmLabel: T('delete') })
    if (!ok) return
    const { error } = await supabase.from('nachricht_geloescht').insert({ nachricht_id: n.id, user_id: profil.id })
    if (error) { toast(error.message, 'error'); return }
    qc.setQueryData(queryKey, alt => alt?.filter(m => m.id !== n.id))
    neuLaden('n-ungelesen')
    setParams({}, { replace: true })
  }

  const zeitText = iso => tagKey(iso, zeitzone) === tagKey(new Date().toISOString(), zeitzone) ? uhrzeit(iso, zeitzone, lang) : tagLabel(iso, zeitzone, lang, T)
  const anWen = n => n.typ === 'broadcast' ? T('n_an_alle') : n.typ === 'kurs' ? (n.kurs?.name ?? T('msg_kurs')) : null

  // ─── Einzelne Nachricht ───
  if (offenId) {
    if (isLoading) return <Seite zurueck={{ to: `${basis}/nachrichten`, label: T('messages') }}><div style={{ marginTop: 24 }}><Laden hoehe={240} /></div></Seite>
    if (!offen) return (
      <Seite zurueck={{ to: `${basis}/nachrichten`, label: T('messages') }}>
        <div style={{ marginTop: 24 }}><Leer text={T('n_nachricht_nicht_gefunden')} /></div>
      </Seite>
    )
    const ziel = anWen(offen) ?? (offen.gesendet_von === profil.id ? offen.empfaenger?.voller_name : null)
    const datum = new Intl.DateTimeFormat({ de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }[lang] ?? 'de-DE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: zeitzone }).format(new Date(offen.gesendet_am))
    return (
      <Seite zurueck={{ to: `${basis}/nachrichten`, label: T('messages') }}>
        <article style={{ padding: '20px 20px 0' }}>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{offen.betreff}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Avatar name={offen.sender?.voller_name} url={offen.sender?.avatar_url} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{offen.sender?.voller_name ?? '–'}</div>
              <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{ziel ? `${T('n_an')} ${ziel} · ` : ''}{datum}</div>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 18, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{offen.inhalt}</div>
          <div style={{ marginTop: 32 }}>
            <Knopf variante="gefahr" icon={Trash2} onClick={() => loeschen(offen)}>{T('n_nachricht_loeschen')}</Knopf>
          </div>
        </article>
      </Seite>
    )
  }

  // ─── Liste ───
  const istGesendet = kannSenden && ordner === 'gesendet'
  const liste = istGesendet ? gesendet : eingang
  const anzahlUngelesen = eingang.filter(n => !n.gelesen?.length).length
  return (
    <Seite titel={T('messages')} zurueck={{ to: `${basis}/ich`, label: T('n_tab_ich') }} rechts={kannSenden && (
      <Knopf klein variante="tint" icon={PenSquare} onClick={() => setParams({ neu: 'broadcast' })}>{T('nl_schreiben')}</Knopf>
    )}>
      {kannSenden && (
        <Segment label={T('messages')} wert={ordner} onChange={setOrdner} style={{ margin: '16px 20px 0' }}
          optionen={[['eingang', T('nl_eingang')], ['gesendet', T('nl_gesendet')]]} />
      )}
      {!istGesendet && (
        <p style={{ margin: '12px 20px 0', fontSize: 16, color: 'var(--text-2)' }}>
          {anzahlUngelesen ? T('n_x_ungelesene').replace('{n}', anzahlUngelesen) : T('n_alles_gelesen')}
        </p>
      )}
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden hoehe={240} /> : liste.length === 0 ? <Leer text={T('n_keine_nachrichten')} /> : (
          <Gruppe>
            {liste.map((n, i) => {
              const ungelesen = !istGesendet && !n.gelesen?.length
              const ziel = anWen(n)
              const person = istGesendet ? (n.empfaenger ?? { voller_name: ziel }) : n.sender
              return (
                <div key={n.id}>
                  {i > 0 && <Trenner />}
                  <Link to={`${basis}/nachrichten?id=${n.id}`} style={{ display: 'flex', gap: 12, padding: '14px 16px', color: 'var(--text)', textDecoration: 'none' }}>
                    <div style={{ width: 10, flexShrink: 0, paddingTop: 16 }}>
                      {ungelesen && <span aria-label={T('n_ungelesen')} style={{ display: 'block', width: 10, height: 10, borderRadius: 5, background: 'var(--primary)' }} />}
                    </div>
                    <Avatar name={person?.voller_name} url={person?.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: ungelesen ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{istGesendet && <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{T('n_an')} </span>}{person?.voller_name ?? '–'}</span>
                        <span style={{ fontSize: 15, color: 'var(--text-2)', flexShrink: 0 }}>{zeitText(n.gesendet_am)}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: ungelesen ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.betreff}</div>
                      <div style={{ fontSize: 15, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.inhalt}</div>
                      {ziel && (
                        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>
                          {n.typ === 'broadcast' ? <Megaphone aria-hidden="true" size={16} /> : <Music aria-hidden="true" size={16} />}{ziel}
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              )
            })}
          </Gruppe>
        )}
      </div>

      {schreiben && (
        <SchreibenBlatt start={schreiben} onClose={() => setParams({}, { replace: true })}
          onGesendet={() => { setParams({}, { replace: true }); setOrdner('gesendet'); neuLaden('n-nachrichten') }} />
      )}
    </Seite>
  )
}

// Nachricht schreiben (Lehrer, Admin): an alle, an einen Kurs oder an eine Person
function SchreibenBlatt({ start, onClose, onGesendet }) {
  const { profil, schule, T, toast } = useApp()
  const { data: kurse = [] } = useLehrerKurse()
  const [typ, setTyp] = useState(['broadcast', 'kurs', 'direkt'].includes(start.typ) ? start.typ : 'broadcast')
  const [kursId, setKursId] = useState(start.kurs ?? '')
  const [an, setAn] = useState(start.an ?? '')
  const [betreff, setBetreff] = useState('')
  const [inhalt, setInhalt] = useState('')
  const [sendet, setSendet] = useState(false)

  const { data: personen = [] } = useQuery({
    queryKey: ['n-empfaenger', schule?.id],
    enabled: !!schule?.id && typ === 'direkt',
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, voller_name')
        .eq('schule_id', schule.id).neq('id', profil.id).eq('aktiv', true).order('voller_name')
      return data ?? []
    },
  })

  async function senden() {
    if (typ === 'kurs' && !kursId) { toast(T('msg_err_course'), 'error'); return }
    if (typ === 'direkt' && !an) { toast(T('msg_err_recipient'), 'error'); return }
    if (!betreff.trim()) { toast(T('msg_err_subject'), 'error'); return }
    if (!inhalt.trim()) { toast(T('msg_err_content'), 'error'); return }
    setSendet(true)
    const felder = {
      typ, betreff: betreff.trim(), inhalt: inhalt.trim(), gesendet_von: profil.id, schule_id: schule.id,
      empfaenger_id: typ === 'direkt' ? an : null, kurs_id: typ === 'kurs' ? kursId : null,
    }
    const { data, error } = await supabase.from('nachrichten').insert(felder).select('id').single()
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    supabase.functions.invoke('send-push', { body: { nachricht_id: data.id } }).catch(() => {})
    supabase.functions.invoke('send-email', { body: {
      type: 'neue_nachricht', nachricht_id: data.id, typ, empfaenger_id: felder.empfaenger_id, kurs_id: felder.kurs_id,
      betreff: felder.betreff, inhalt: felder.inhalt, absender_id: profil.id,
    } }).catch(() => {})
    toast(T('nl_gesendet_ok'), 'success')
    onGesendet()
  }

  return (
    <Blatt titel={T('nl_neue_nachricht')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segment label={T('nl_an_wen')} wert={typ} onChange={setTyp}
          optionen={[['broadcast', T('nl_an_alle')], ['kurs', T('nl_an_kurs')], ['direkt', T('nl_an_person')]]} />
        {typ === 'kurs' && (
          <Feld label={T('msg_kurs')}>
            <select value={kursId} onChange={e => setKursId(e.target.value)} style={eingabeStil}>
              <option value="">{T('nl_bitte_waehlen')}</option>
              {kurse.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </Feld>
        )}
        {typ === 'direkt' && (
          <Feld label={T('nl_empfaenger')}>
            <select value={an} onChange={e => setAn(e.target.value)} style={eingabeStil}>
              <option value="">{T('nl_bitte_waehlen')}</option>
              {personen.map(p => <option key={p.id} value={p.id}>{p.voller_name}</option>)}
            </select>
          </Feld>
        )}
        <Feld label={T('nl_betreff')}>
          <input value={betreff} onChange={e => setBetreff(e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('nl_nachricht_text')}>
          <textarea rows={6} value={inhalt} onChange={e => setInhalt(e.target.value)} style={{ ...eingabeStil, resize: 'vertical', lineHeight: 1.45 }} />
        </Feld>
        <Knopf voll icon={Send} onClick={senden} disabled={sendet}>{T('nl_senden')}</Knopf>
      </div>
    </Blatt>
  )
}

function Avatar({ name, url }) {
  return (
    <span aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 22, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, overflow: 'hidden' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name?.[0] ?? '?').toUpperCase()}
    </span>
  )
}
