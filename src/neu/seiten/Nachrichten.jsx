import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Music, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Gruppe, Trenner, Leer, Laden, Knopf } from '../../ui'
import { useNeuLaden } from '../daten'
import { uhrzeit, tagLabel, tagKey } from '../zeit'

// Posteingang (Schüler empfangen nur). Die geöffnete Nachricht steht in ?id=…,
// damit „Zurück“ im Browser bzw. auf dem Handy zur Liste führt.
export default function NeuNachrichten() {
  const { profil, T, lang, zeitzone, toast, confirm } = useApp()
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const neuLaden = useNeuLaden()
  const offenId = params.get('id')

  const queryKey = ['n-nachrichten', profil?.id]
  const { data: nachrichten = [], isLoading } = useQuery({
    queryKey,
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('nachrichten')
        .select('id, typ, betreff, inhalt, gesendet_am, gesendet_von, empfaenger_id, sender:profiles!nachrichten_gesendet_von_fkey(voller_name, avatar_url), kurs:unterricht(name), gelesen:nachricht_gelesen(nachricht_id), geloescht:nachricht_geloescht(nachricht_id)')
        .order('gesendet_am', { ascending: false })
      if (error) throw error
      return (data ?? []).filter(n => !n.geloescht?.length && (n.gesendet_von !== profil.id || n.empfaenger_id === profil.id))
    },
  })

  useEffect(() => {
    const ch = supabase.channel('n_nachrichten')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachrichten' }, () => neuLaden('n-nachrichten', 'n-ungelesen'))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

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
    if (isLoading) return <Seite zurueck={{ to: '/schueler/nachrichten', label: T('messages') }}><div style={{ marginTop: 24 }}><Laden hoehe={240} /></div></Seite>
    if (!offen) return (
      <Seite zurueck={{ to: '/schueler/nachrichten', label: T('messages') }}>
        <div style={{ marginTop: 24 }}><Leer text={T('n_nachricht_nicht_gefunden')} /></div>
      </Seite>
    )
    const ziel = anWen(offen)
    const datum = new Intl.DateTimeFormat({ de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }[lang] ?? 'de-DE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: zeitzone }).format(new Date(offen.gesendet_am))
    return (
      <Seite zurueck={{ to: '/schueler/nachrichten', label: T('messages') }}>
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
  const anzahlUngelesen = nachrichten.filter(n => !n.gelesen?.length).length
  return (
    <Seite titel={T('messages')} zurueck={{ to: '/schueler/ich', label: T('n_tab_ich') }}>
      <p style={{ margin: '8px 20px 0', fontSize: 16, color: 'var(--text-2)' }}>
        {anzahlUngelesen ? T('n_x_ungelesene').replace('{n}', anzahlUngelesen) : T('n_alles_gelesen')}
      </p>
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden hoehe={240} /> : nachrichten.length === 0 ? <Leer text={T('n_keine_nachrichten')} /> : (
          <Gruppe>
            {nachrichten.map((n, i) => {
              const ungelesen = !n.gelesen?.length
              const ziel = anWen(n)
              return (
                <div key={n.id}>
                  {i > 0 && <Trenner />}
                  <Link to={`/schueler/nachrichten?id=${n.id}`} style={{ display: 'flex', gap: 12, padding: '14px 16px', color: 'var(--text)', textDecoration: 'none' }}>
                    <div style={{ width: 10, flexShrink: 0, paddingTop: 16 }}>
                      {ungelesen && <span aria-label={T('n_ungelesen')} style={{ display: 'block', width: 10, height: 10, borderRadius: 5, background: 'var(--primary)' }} />}
                    </div>
                    <Avatar name={n.sender?.voller_name} url={n.sender?.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: ungelesen ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sender?.voller_name ?? '–'}</span>
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
    </Seite>
  )
}

function Avatar({ name, url }) {
  return (
    <span aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 22, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, overflow: 'hidden' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name?.[0] ?? '?').toUpperCase()}
    </span>
  )
}
