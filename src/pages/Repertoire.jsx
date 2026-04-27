import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const STATUS_FARBE = { aktuell:'var(--accent)', geplant:'var(--primary)', abgeschlossen:'var(--text-3)', archiviert:'var(--text-3)' }
const STATUS_LABEL = { aktuell:'Aktuell', geplant:'Geplant', abgeschlossen:'Abgeschlossen', archiviert:'Archiviert' }

// ─── Stück anlegen Modal ──────────────────────────────────────
function NeuesStueckModal({ onClose, onErfolg }) {
  const { profil, T } = useApp()
  const [form, setForm] = useState({ titel:'', komponist:'', tonart:'', tempo:'', youtube_url:'' })
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (!form.titel.trim()) { setFehler('Titel ist erforderlich.'); return }
    setLaden(true)
    const { error } = await supabase.from('stuecke').insert({ ...form, erstellt_von: profil.id })
    if (error) { setFehler(error.message); setLaden(false); return }
    onErfolg(); onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>🎵 Neues Stück</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { key:'titel',       label:'Titel *',      placeholder:'z.B. Ave Maria' },
            { key:'komponist',   label:'Komponist',    placeholder:'z.B. Schubert' },
            { key:'tonart',      label:'Tonart',       placeholder:'z.B. F-Dur' },
            { key:'tempo',       label:'Tempo',        placeholder:'z.B. Andante / 80 BPM' },
            { key:'youtube_url', label:'YouTube-Link', placeholder:'https://youtube.com/...' },
          ].map(f => (
            <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{f.label}</label>
              <input style={s.input} placeholder={f.placeholder} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? T('loading') : T('piece_create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stück-Karte ──────────────────────────────────────────────
function StueckKarte({ stueck, kurse = [], onClick }) {
  const hatNoten   = stueck.stueck_dateien?.some(d => d.typ === 'noten')
  const hatAudio   = stueck.stueck_dateien?.some(d => d.typ === 'audio')
  const hatAkkorde = stueck.stueck_dateien?.some(d => d.typ === 'akkorde') || stueck.notizen
  const hatVideo   = !!stueck.youtube_url
  const hatText    = !!stueck.liedtext

  return (
    <div onClick={onClick}
      style={{ background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'16px 18px', cursor:'pointer', transition:'border-color 0.15s', display:'flex', flexDirection:'column', gap:10, boxShadow:'var(--shadow)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>

      {/* Titel + Komponist */}
      <div>
        <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:3 }}>{stueck.titel}</div>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>
          {stueck.komponist && <span>🎼 {stueck.komponist}</span>}
          {stueck.tonart    && <span style={{ marginLeft:10 }}>🎵 {stueck.tonart}</span>}
        </div>
      </div>

      {/* Inhalt-Badges */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {hatNoten   && <span style={s.badge}>📄 Noten</span>}
        {hatAudio   && <span style={s.badge}>🎵 Audio</span>}
        {hatAkkorde && <span style={s.badge}>🎸 Akkorde</span>}
        {hatVideo   && <span style={s.badge}>▶️ Video</span>}
        {hatText    && <span style={s.badge}>📝 Text</span>}
        {!hatNoten && !hatAudio && !hatAkkorde && !hatVideo && !hatText &&
          <span style={{ ...s.badge, opacity:0.5 }}>Noch leer</span>}
      </div>

      {/* Kurse */}
      {kurse.length > 0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {kurse.map(k => (
            <span key={k.id} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', color: STATUS_FARBE[k.status] ?? 'var(--text-3)', border:`1px solid ${STATUS_FARBE[k.status] ?? 'var(--border)'}`, fontWeight:600 }}>
              {k.name} · {STATUS_LABEL[k.status] ?? k.status}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Repertoire() {
  const { profil, rolle, T } = useApp()
  const navigate  = useNavigate()
  const location  = useLocation()
  const rolle_    = location.pathname.split('/')[1]   // admin | lehrer | schueler
  const istAdmin   = rolle === 'admin' || rolle === 'superadmin'
  const istSchueler = rolle === 'schueler'

  const [tab,         setTab]         = useState(istSchueler ? 'meine' : 'bibliothek')
  const [bibliothek,  setBibliothek]  = useState([])
  const [meineStuecke, setMeineStuecke] = useState([])   // { stueck, kurse[] }
  const [laden,       setLaden]       = useState(true)
  const [suche,       setSuche]       = useState('')
  const [filter,      setFilter]      = useState('alle')  // alle | noten | audio | video | text
  const [kursFilter,  setKursFilter]  = useState('alle')
  const [modal,       setModal]       = useState(false)

  const ladeDaten = useCallback(async () => {
    setLaden(true)

    // ── Bibliothek: alle Stücke (nur für Admin/Lehrer) ──────
    if (!istSchueler) {
      const { data: alle } = await supabase
        .from('stuecke')
        .select('*, stueck_dateien(typ)')
        .order('titel')
      setBibliothek(alle ?? [])
    }

    // ── Meine Stücke: Stücke aus eigenen Kursen ──────────────
    if (!profil) { setLaden(false); return }

    let unterrichtIds = []
    if (istAdmin) {
      const { data } = await supabase.from('unterricht').select('id, name')
      unterrichtIds = data ?? []
    } else if (istSchueler) {
      const { data } = await supabase.from('unterricht_schueler').select('unterricht_id, unterricht(id, name)').eq('schueler_id', profil.id).eq('status', 'aktiv')
      unterrichtIds = (data ?? []).map(d => d.unterricht).filter(Boolean)
    } else {
      const { data } = await supabase.from('unterricht_lehrer').select('unterricht_id, unterricht(id, name)').eq('lehrer_id', profil.id)
      unterrichtIds = (data ?? []).map(d => d.unterricht).filter(Boolean)
    }

    if (unterrichtIds.length === 0) { setLaden(false); return }

    const ids = unterrichtIds.map(u => u.id)
    const { data: us } = await supabase
      .from('unterricht_stuecke')
      .select('stueck_id, status, unterricht_id')
      .in('unterricht_id', ids)

    if (!us?.length) { setMeineStuecke([]); setLaden(false); return }

    const stueckIds = [...new Set(us.map(u => u.stueck_id))]
    const { data: stuecke } = await supabase
      .from('stuecke')
      .select('*, stueck_dateien(typ)')
      .in('id', stueckIds)
      .order('titel')

    // Für jedes Stück: welche Kurse und Status?
    const kursMap = Object.fromEntries(unterrichtIds.map(u => [u.id, u.name]))
    const grouped = (stuecke ?? []).map(st => ({
      stueck: st,
      kurse: us
        .filter(u => u.stueck_id === st.id)
        .map(u => ({ id: u.unterricht_id, name: kursMap[u.unterricht_id] ?? '–', status: u.status })),
    }))

    setMeineStuecke(grouped)
    setLaden(false)
  }, [profil, istAdmin])

  useEffect(() => { ladeDaten() }, [ladeDaten])

  function oeffne(stueckId) {
    navigate(`/${rolle_}/repertoire/${stueckId}`)
  }

  // Filter + Suche auf Bibliothek
  const gefilterteBibliothek = bibliothek.filter(st => {
    const trifftSuche = !suche ||
      st.titel?.toLowerCase().includes(suche.toLowerCase()) ||
      st.komponist?.toLowerCase().includes(suche.toLowerCase())
    const trifftFilter =
      filter === 'alle'   ? true :
      filter === 'noten'  ? st.stueck_dateien?.some(d => d.typ === 'noten') :
      filter === 'audio'  ? st.stueck_dateien?.some(d => d.typ === 'audio') :
      filter === 'video'  ? !!st.youtube_url :
      filter === 'text'   ? !!st.liedtext : true
    return trifftSuche && trifftFilter
  })

  // Kursliste für Schüler-Filter
  const meineKurse = [...new Map(
    meineStuecke.flatMap(({ kurse }) => kurse).map(k => [k.id, k])
  ).values()]

  // Filter + Suche auf Meine Stücke
  const gefilterteMeine = meineStuecke.filter(({ stueck, kurse }) => {
    const trifftSuche = !suche ||
      stueck.titel?.toLowerCase().includes(suche.toLowerCase()) ||
      stueck.komponist?.toLowerCase().includes(suche.toLowerCase())
    const trifftKurs = kursFilter === 'alle' || kurse.some(k => k.id === kursFilter)
    return trifftSuche && trifftKurs
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' }}>🎼 {T('repertoire_title')}</h1>
        {!istSchueler && <button onClick={() => setModal(true)} style={s.btnPri}>{T('repertoire_new_piece')}</button>}
      </div>

      {/* Tabs (nur für Admin/Lehrer) */}
      {!istSchueler && (
        <div style={{ display:'flex', gap:0, borderBottom:'2px solid var(--border)', marginBottom:20 }}>
          {[
            ['bibliothek', `${T('repertoire_library')} (${bibliothek.length})`],
            ['meine',      `${T('repertoire_mine')} (${meineStuecke.length})`],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding:'10px 20px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 800 : 500, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Suche + Filter */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <input
          placeholder={T('repertoire_search')}
          value={suche} onChange={e => setSuche(e.target.value)}
          style={{ ...s.input, flex:1, minWidth:200 }} />
        {istSchueler && meineKurse.length > 1 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button onClick={() => setKursFilter('alle')}
              style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: kursFilter==='alle' ? 'var(--primary)' : 'var(--surface)', color: kursFilter==='alle' ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              Alle Kurse
            </button>
            {meineKurse.map(k => (
              <button key={k.id} onClick={() => setKursFilter(k.id)}
                style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: kursFilter===k.id ? 'var(--primary)' : 'var(--surface)', color: kursFilter===k.id ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {k.name}
              </button>
            ))}
          </div>
        )}
        {!istSchueler && tab === 'bibliothek' && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[
              ['alle',  'Alle'],
              ['noten', '📄 Noten'],
              ['audio', '🎵 Audio'],
              ['video', '▶️ Video'],
              ['text',  '📝 Text'],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: filter===k ? 'var(--primary)' : 'var(--surface)', color: filter===k ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {laden ? (
        <div style={s.leer}>{T('repertoire_loading')}</div>
      ) : tab === 'bibliothek' ? (

        // ── BIBLIOTHEK ────────────────────────────────────────
        gefilterteBibliothek.length === 0 ? (
          <div style={s.leer}>{suche ? T('repertoire_no_match') : T('repertoire_empty_library')}</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
            {gefilterteBibliothek.map(st => (
              <StueckKarte key={st.id} stueck={st} onClick={() => oeffne(st.id)} />
            ))}
          </div>
        )

      ) : (

        // ── MEINE STÜCKE ──────────────────────────────────────
        gefilterteMeine.length === 0 ? (
          <div style={s.leer}>{suche ? T('repertoire_no_match') : T('repertoire_empty_mine')}</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {gefilterteMeine.map(({ stueck, kurse }) => (
              <StueckKarte key={stueck.id} stueck={stueck} kurse={kurse} onClick={() => oeffne(stueck.id)} />
            ))}
          </div>
        )
      )}

      {modal && (
        <NeuesStueckModal onClose={() => setModal(false)} onErfolg={() => { setModal(false); ladeDaten() }} />
      )}
    </div>
  )
}

const s = {
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:      { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' },
  modalHeader:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
  modalTitel: { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  iconBtn:    { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  label:      { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:      { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', boxSizing:'border-box' },
  btnPri:     { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:     { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  badge:      { fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', color:'var(--text-3)', border:'1px solid var(--border)', fontWeight:600 },
  leer:       { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
}
