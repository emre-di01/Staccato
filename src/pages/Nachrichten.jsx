import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../hooks/useWindowWidth'

function zeitAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'Gerade eben'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} Min.`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} Std.`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} Tagen`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function RolleChip({ rolle }) {
  const farben = { admin: '#6366f1', superadmin: '#8b5cf6', lehrer: '#0ea5e9', schueler: '#10b981', eltern: '#f59e0b', vorstand: '#ec4899' }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: farben[rolle] + '22', color: farben[rolle], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {rolle}
    </span>
  )
}

function ComposeModal({ onClose, onErfolg, profil, rolle, T, mob }) {
  const [typ, setTyp]               = useState('broadcast')
  const [empfaengerId, setEmpfaengerId] = useState('')
  const [kursId, setKursId]         = useState('')
  const [betreff, setBetreff]       = useState('')
  const [inhalt, setInhalt]         = useState('')
  const [empfaengerListe, setEmpfaengerListe] = useState([])
  const [kursListe, setKursListe]   = useState([])
  const [laden, setLaden]           = useState(false)
  const [fehler, setFehler]         = useState('')

  useEffect(() => {
    supabase.from('profiles')
      .select('id, voller_name, rolle')
      .eq('schule_id', profil.schule_id)
      .neq('id', profil.id)
      .eq('aktiv', true)
      .order('voller_name')
      .then(({ data }) => setEmpfaengerListe(data ?? []))
  }, [profil.schule_id, profil.id])

  useEffect(() => {
    if (typ !== 'kurs') return
    if (rolle === 'lehrer') {
      supabase.from('unterricht_lehrer')
        .select('unterricht:unterricht(id, name)')
        .eq('lehrer_id', profil.id)
        .then(({ data }) => setKursListe((data ?? []).map(r => r.unterricht).filter(Boolean)))
    } else {
      supabase.from('unterricht')
        .select('id, name')
        .eq('schule_id', profil.schule_id)
        .eq('aktiv', true)
        .order('name')
        .then(({ data }) => setKursListe(data ?? []))
    }
  }, [typ, profil.schule_id, profil.id, rolle])

  async function senden() {
    if (!betreff.trim()) { setFehler(T('msg_err_subject')); return }
    if (!inhalt.trim())  { setFehler(T('msg_err_content')); return }
    if (typ === 'direkt' && !empfaengerId) { setFehler(T('msg_err_recipient')); return }
    if (typ === 'kurs'   && !kursId)       { setFehler(T('msg_err_course')); return }
    setLaden(true); setFehler('')
    const { error } = await supabase.from('nachrichten').insert({
      typ,
      betreff:      betreff.trim(),
      inhalt:       inhalt.trim(),
      gesendet_von: profil.id,
      schule_id:    profil.schule_id,
      empfaenger_id: typ === 'direkt' ? empfaengerId : null,
      kurs_id:       typ === 'kurs'   ? kursId       : null,
    })
    setLaden(false)
    if (error) { setFehler(error.message); return }
    onErfolg(); onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(3px)', display:'flex', alignItems: mob ? 'flex-end' : 'center', justifyContent:'center', padding: mob ? 0 : 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius: mob ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)', padding: mob ? '20px 16px 32px' : '28px 32px', width:'100%', maxWidth: mob ? '100%' : 520, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight: mob ? '90dvh' : 'auto', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>✏️ {T('msg_compose')}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)' }}>✕</button>
        </div>

        {/* Typ */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {['broadcast','kurs','direkt'].map(t => (
            <button key={t} onClick={() => setTyp(t)}
              style={{ flex:1, padding:'10px 8px', borderRadius:'var(--radius)', border:`1.5px solid ${typ===t?'var(--primary)':'var(--border)'}`, background: typ===t ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg)', color: typ===t ? 'var(--primary)' : 'var(--text-2)', fontWeight: typ===t ? 700 : 500, fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
              {t === 'broadcast' ? `📢 ${T('msg_broadcast')}` : t === 'kurs' ? `🎵 ${T('msg_kurs')}` : `👤 ${T('msg_direct')}`}
            </button>
          ))}
        </div>

        {/* Kurs-Auswahl */}
        {typ === 'kurs' && (
          <div style={{ marginBottom:16 }}>
            <label style={sty.label}>{T('msg_kurs')}</label>
            <select value={kursId} onChange={e => setKursId(e.target.value)} style={sty.input}>
              <option value="">— Kurs wählen —</option>
              {kursListe.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Empfänger (nur bei direkt) */}
        {typ === 'direkt' && (
          <div style={{ marginBottom:16 }}>
            <label style={sty.label}>{T('msg_recipient')}</label>
            <select value={empfaengerId} onChange={e => setEmpfaengerId(e.target.value)} style={sty.input}>
              <option value="">— {T('msg_recipient')} wählen —</option>
              {empfaengerListe.map(p => (
                <option key={p.id} value={p.id}>{p.voller_name} ({p.rolle})</option>
              ))}
            </select>
          </div>
        )}

        {/* Betreff */}
        <div style={{ marginBottom:16 }}>
          <label style={sty.label}>{T('msg_subject')}</label>
          <input value={betreff} onChange={e => setBetreff(e.target.value)} style={sty.input} placeholder={T('msg_subject')} maxLength={120} />
        </div>

        {/* Inhalt */}
        <div style={{ marginBottom:20 }}>
          <label style={sty.label}>{T('msg_content')}</label>
          <textarea value={inhalt} onChange={e => setInhalt(e.target.value)} style={{ ...sty.input, height:140, resize:'vertical', fontFamily:'inherit' }} placeholder={T('msg_content')} />
        </div>

        {fehler && <div style={{ fontSize:13, color:'var(--danger)', marginBottom:12, fontWeight:600 }}>{fehler}</div>}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'10px 20px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            {T('cancel')}
          </button>
          <button onClick={senden} disabled={laden} style={{ padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: laden ? 0.7 : 1 }}>
            {laden ? '…' : `📤 ${T('msg_send')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Nachrichten() {
  const { profil, rolle, T } = useApp()
  const mob = useIsMobile()
  const kannSenden = ['admin', 'superadmin', 'lehrer'].includes(rolle)

  const [nachrichten, setNachrichten]   = useState([])
  const [laden, setLaden]               = useState(true)
  const [tab, setTab]                   = useState('eingang')
  const [ausgewaehlt, setAusgewaehlt]   = useState(null)
  const [composeOffen, setComposeOffen] = useState(false)

  const laden_ = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase
      .from('nachrichten')
      .select('*, sender:profiles!nachrichten_gesendet_von_fkey(id, voller_name, rolle), empfaenger:profiles!nachrichten_empfaenger_id_fkey(id, voller_name, rolle), gelesen:nachricht_gelesen(nachricht_id), kurs:unterricht(id, name)')
      .order('gesendet_am', { ascending: false })
    setNachrichten(data ?? [])
    setLaden(false)
  }, [])

  useEffect(() => { laden_() }, [laden_])

  useEffect(() => {
    const ch = supabase.channel('nachrichten_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachrichten' }, laden_)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachricht_gelesen' }, laden_)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [laden_])

  async function markierenGelesen(n) {
    if (n.gelesen?.length || n.gesendet_von === profil.id) return
    await supabase.from('nachricht_gelesen').upsert({ nachricht_id: n.id, user_id: profil.id })
    setNachrichten(prev => prev.map(m => m.id === n.id ? { ...m, gelesen: [{ nachricht_id: n.id }] } : m))
  }

  function waehleNachricht(n) {
    setAusgewaehlt(n)
    markierenGelesen(n)
  }

  const eingang  = nachrichten.filter(n => n.gesendet_von !== profil.id || n.empfaenger_id === profil.id)
  const gesendet = nachrichten.filter(n => n.gesendet_von === profil.id)
  const liste    = tab === 'eingang' ? eingang : gesendet
  const ungelesen = eingang.filter(n => !n.gelesen?.length).length

  function empfaengerLabel(n, istGesendet) {
    if (n.typ === 'broadcast') return '📢 Alle'
    if (n.typ === 'kurs')      return `🎵 ${n.kurs?.name ?? T('msg_kurs')}`
    if (istGesendet)           return n.empfaenger?.voller_name ?? '—'
    return n.sender?.voller_name ?? '—'
  }

  // Auf Mobil: Detail ersetzt die Liste (Stack-Navigation)
  const zeigeDetail  = mob && ausgewaehlt !== null
  const zeigeListe   = !mob || !zeigeDetail

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Header – auf Mobil im Detail-View: Zurück-Button statt Titel */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: mob ? 16 : 28 }}>
        {zeigeDetail ? (
          <button onClick={() => setAusgewaehlt(null)}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--primary)', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:'4px 0' }}>
            ← {T('msg_inbox')}
          </button>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <h1 style={{ margin:0, fontSize: mob ? 20 : 24, fontWeight:800, color:'var(--text)' }}>💬 {T('messages')}</h1>
            {ungelesen > 0 && (
              <span style={{ background:'var(--primary)', color:'var(--primary-fg)', fontSize:12, fontWeight:800, padding:'3px 9px', borderRadius:99 }}>
                {ungelesen} {T('msg_unread')}
              </span>
            )}
          </div>
        )}
        {kannSenden && !zeigeDetail && (
          <button onClick={() => setComposeOffen(true)}
            style={{ display:'flex', alignItems:'center', gap:8, padding: mob ? '8px 14px' : '10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {mob ? '✏️' : `✏️ ${T('msg_compose')}`}
          </button>
        )}
      </div>

      {/* Layout: Desktop = 2 Spalten, Mobil = Stack */}
      <div style={{ display: mob ? 'block' : 'grid', gridTemplateColumns: ausgewaehlt ? '340px 1fr' : '1fr', gap:16, alignItems:'start' }}>

        {/* Liste */}
        {zeigeListe && (
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden' }}>
            {/* Tabs */}
            {kannSenden && (
              <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
                {['eingang','gesendet'].map(t => (
                  <button key={t} onClick={() => { setTab(t); setAusgewaehlt(null) }}
                    style={{ flex:1, padding:'12px', border:'none', background: tab===t ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent', color: tab===t ? 'var(--primary)' : 'var(--text-3)', fontWeight: tab===t ? 700 : 500, fontSize:13, cursor:'pointer', fontFamily:'inherit', borderBottom: tab===t ? '2px solid var(--primary)' : '2px solid transparent', transition:'all 0.15s' }}>
                    {t === 'eingang' ? `📥 ${T('msg_inbox')}${ungelesen > 0 ? ` (${ungelesen})` : ''}` : `📤 ${T('msg_sent')}`}
                  </button>
                ))}
              </div>
            )}

            {/* Nachrichten-Liste */}
            {laden ? (
              <div style={{ padding:32, textAlign:'center', color:'var(--text-3)', fontSize:14 }}>⏳ {T('loading')}</div>
            ) : liste.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--text-3)' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:14 }}>{T('msg_empty')}</div>
              </div>
            ) : liste.map(n => {
              const istGelesen = n.gelesen?.length > 0 || n.gesendet_von === profil.id
              const istAktiv   = !mob && ausgewaehlt?.id === n.id
              const hauptLabel = empfaengerLabel(n, tab === 'gesendet')
              return (
                <div key={n.id} onClick={() => waehleNachricht(n)}
                  style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', background: istAktiv ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : istGelesen ? 'transparent' : 'color-mix(in srgb, var(--primary) 4%, transparent)', borderLeft: istAktiv ? '3px solid var(--primary)' : '3px solid transparent', transition:'background 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                      {!istGelesen && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--primary)', flexShrink:0 }} />}
                      <span style={{ fontSize:13, fontWeight: istGelesen ? 500 : 700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {hauptLabel}
                      </span>
                      {(n.typ === 'broadcast' || n.typ === 'kurs') && tab === 'eingang' && n.sender && (
                        <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>von {n.sender.voller_name}</span>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                      <span style={{ fontSize:11, color:'var(--text-3)' }}>{zeitAgo(n.gesendet_am)}</span>
                      {mob && <span style={{ fontSize:12, color:'var(--text-3)' }}>›</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:13, fontWeight: istGelesen ? 400 : 600, color:'var(--text-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {n.betreff}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {n.inhalt}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Detail */}
        {ausgewaehlt && (
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding: mob ? '16px' : '24px 28px', position: mob ? 'static' : 'sticky', top:24 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ minWidth:0, flex:1 }}>
                <h2 style={{ margin:'0 0 8px', fontSize: mob ? 16 : 18, fontWeight:800, color:'var(--text)', wordBreak:'break-word' }}>{ausgewaehlt.betreff}</h2>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>
                    {T('msg_from')}: <strong style={{ color:'var(--text-2)' }}>{ausgewaehlt.sender?.voller_name ?? '—'}</strong>
                  </span>
                  {ausgewaehlt.sender?.rolle && <RolleChip rolle={ausgewaehlt.sender.rolle} />}
                  {ausgewaehlt.typ === 'broadcast'
                    ? <span style={{ fontSize:12, color:'var(--text-3)' }}>→ 📢 {T('msg_broadcast')}</span>
                    : ausgewaehlt.typ === 'kurs'
                    ? <span style={{ fontSize:12, color:'var(--text-3)' }}>→ 🎵 {ausgewaehlt.kurs?.name ?? T('msg_kurs')}</span>
                    : ausgewaehlt.empfaenger && <span style={{ fontSize:12, color:'var(--text-3)' }}>→ {ausgewaehlt.empfaenger.voller_name}</span>
                  }
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>
                    {new Date(ausgewaehlt.gesendet_am).toLocaleString('de-DE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
              </div>
              {!mob && (
                <button onClick={() => setAusgewaehlt(null)}
                  style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', flexShrink:0, marginLeft:16 }}>✕</button>
              )}
            </div>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <p style={{ margin:0, fontSize:15, color:'var(--text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{ausgewaehlt.inhalt}</p>
            </div>
          </div>
        )}
      </div>

      {composeOffen && (
        <ComposeModal profil={profil} rolle={rolle} T={T} mob={mob} onClose={() => setComposeOffen(false)} onErfolg={laden_} />
      )}
    </div>
  )
}

const sty = {
  label: { display:'block', fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 },
  input: { width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, outline:'none', fontFamily:'inherit' },
}
