import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''

const DOK_TYP_LABEL = {
  aufnahmeformular: 'Aufnahmeformular',
  vertrag:          'Vertrag',
  sepa:             'SEPA-Mandat',
  einverstaendnis:  'Einverständnis',
  sonstiges:        'Sonstiges',
}

function DokumentZeile({ datei, T }) {
  const [laden, setLaden] = useState(false)
  async function oeffnen() {
    setLaden(true)
    const { data } = await supabase.storage.from('mitglied-dateien').createSignedUrl(datei.bucket_pfad, 86400)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    setLaden(false)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datei.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
          {T(`dok_type_${datei.typ}`) || datei.typ} · {new Date(datei.hochgeladen_am).toLocaleDateString('de-DE')}
        </div>
      </div>
      <button onClick={oeffnen} disabled={laden}
        style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {laden ? '…' : T('dok_open')}
      </button>
    </div>
  )
}

export default function ProfilSeite() {
  const { profil, ladeProfil, T, rolle } = useApp()
  const fileRef = useRef()

  const [form, setForm] = useState({
    voller_name:  profil?.voller_name  ?? '',
    telefon:      profil?.telefon      ?? '',
    adresse:      profil?.adresse      ?? '',
    geburtsdatum: profil?.geburtsdatum ?? '',
  })
  const [pw, setPw]         = useState({ alt: '', neu: '', neu2: '' })
  const [laden,  setLaden]  = useState(false)
  const [pwLaden, setPwLaden] = useState(false)
  const [erfolg, setErfolg] = useState('')
  const [fehler, setFehler] = useState('')
  const [avatarLaden, setAvatarLaden] = useState(false)
  const [dateien,     setDateien]     = useState([])
  const [dateiLaden,  setDateiLaden]  = useState(true)

  const DEFAULT_NOTIF = { event_invite: true, new_piece: true }
  const [notifPrefs,  setNotifPrefs]  = useState({ ...DEFAULT_NOTIF, ...(profil?.email_benachrichtigungen ?? {}) })
  const [notifLaden,  setNotifLaden]  = useState(false)
  const [notifErfolg, setNotifErfolg] = useState(false)

  const [kalenderToken, setKalenderToken] = useState(null)
  const [kalTokenLaden, setKalTokenLaden] = useState(true)
  const [icalKopiert,   setIcalKopiert]   = useState(false)

  useEffect(() => {
    if (!profil?.id) return
    supabase.from('mitglied_dateien')
      .select('*').eq('profil_id', profil.id).order('hochgeladen_am', { ascending: false })
      .then(({ data }) => { setDateien(data ?? []); setDateiLaden(false) })
  }, [profil?.id])

  useEffect(() => {
    if (!profil?.id) return
    supabase.from('profiles').select('kalender_token').eq('id', profil.id).single()
      .then(({ data }) => { setKalenderToken(data?.kalender_token ?? null); setKalTokenLaden(false) })
  }, [profil?.id])

  const kalenderUrl = kalenderToken
    ? `${SUPABASE_URL}/functions/v1/kalender?token=${kalenderToken}`
    : ''

  async function icalKopieren() {
    if (!kalenderUrl) return
    await navigator.clipboard.writeText(kalenderUrl)
    setIcalKopiert(true)
    setTimeout(() => setIcalKopiert(false), 2000)
  }

  async function kalenderTokenNeu() {
    const neuToken = crypto.randomUUID()
    await supabase.from('profiles').update({ kalender_token: neuToken }).eq('id', profil.id)
    setKalenderToken(neuToken)
  }

  async function profilSpeichern() {
    setLaden(true); setFehler(''); setErfolg('')
    const payload = { ...form, geburtsdatum: form.geburtsdatum || null }
    const { error } = await supabase.from('profiles').update(payload).eq('id', profil.id)
    if (error) setFehler(error.message)
    else { setErfolg('Profil gespeichert!'); await ladeProfil(profil.id) }
    setLaden(false)
  }

  async function notifSpeichern() {
    setNotifLaden(true)
    await supabase.from('profiles').update({ email_benachrichtigungen: notifPrefs }).eq('id', profil.id)
    await ladeProfil(profil.id)
    setNotifErfolg(true)
    setTimeout(() => setNotifErfolg(false), 2000)
    setNotifLaden(false)
  }

  async function passwortAendern() {
    if (!pw.neu || pw.neu !== pw.neu2) { setFehler('Passwörter stimmen nicht überein.'); return }
    if (pw.neu.length < 6) { setFehler('Passwort muss mindestens 6 Zeichen haben.'); return }
    setPwLaden(true); setFehler(''); setErfolg('')
    const { error } = await supabase.auth.updateUser({ password: pw.neu })
    if (error) setFehler(error.message)
    else { setErfolg('Passwort geändert!'); setPw({ alt:'', neu:'', neu2:'' }) }
    setPwLaden(false)
  }

  async function avatarHochladen(e) {
    const datei = e.target.files[0]
    if (!datei) return
    setAvatarLaden(true); setFehler(''); setErfolg('')
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${profil.id}/avatar_${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('avatare').upload(pfad, datei, { upsert: true })
    if (sErr) { setFehler('Bild-Upload fehlgeschlagen: ' + sErr.message); setAvatarLaden(false); return }
    const { data } = supabase.storage.from('avatare').getPublicUrl(pfad)
    const { error: dErr } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profil.id)
    if (dErr) { setFehler('Profil-Update fehlgeschlagen: ' + dErr.message); setAvatarLaden(false); return }
    await ladeProfil(profil.id)
    setErfolg('Profilbild gespeichert!')
    setAvatarLaden(false)
  }

  async function avatarLoeschen() {
    if (!profil.avatar_url) return
    setAvatarLaden(true); setFehler(''); setErfolg('')
    const match = profil.avatar_url.split('?')[0].match(/\/avatare\/(.+)$/)
    if (match) await supabase.storage.from('avatare').remove([decodeURIComponent(match[1])])
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profil.id)
    if (error) { setFehler('Löschen fehlgeschlagen: ' + error.message); setAvatarLaden(false); return }
    await ladeProfil(profil.id)
    setErfolg('Profilbild gelöscht.')
    setAvatarLaden(false)
  }

  const initialen = profil?.voller_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={s.h1}>👤 {T('profile_title')}</h1>

      {/* Avatar */}
      <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32, padding:'20px 24px', background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
        <div style={{ position:'relative' }}>
          {profil?.avatar_url ? (
            <img src={profil.avatar_url + '?t=' + (profil.updated_at ?? '')} alt="Avatar"
              style={{ width:72, height:72, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--primary)' }} />
          ) : (
            <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--primary)', color:'var(--primary-fg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800 }}>
              {initialen}
            </div>
          )}
          <button onClick={() => fileRef.current.click()}
            style={{ position:'absolute', bottom:-4, right:-4, width:26, height:26, borderRadius:'50%', background:'var(--accent)', border:'2px solid var(--surface)', color:'var(--accent-fg)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {avatarLaden ? '…' : '✎'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={avatarHochladen} />
          {profil?.avatar_url && (
            <button onClick={avatarLoeschen} disabled={avatarLaden}
              style={{ position:'absolute', top:-4, right:-4, width:20, height:20, borderRadius:'50%', background:'var(--danger)', border:'2px solid var(--surface)', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
              ✕
            </button>
          )}
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'var(--text)' }}>{profil?.voller_name}</div>
          <div style={{ fontSize:13, color:'var(--text-3)', textTransform:'capitalize', marginTop:2 }}>{profil?.rolle}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{profil?.schule_id && 'Staccato Musikschule'}</div>
        </div>
      </div>

      {erfolg && <div style={s.erfolg}>{erfolg}</div>}
      {fehler && <div style={s.fehler}>{fehler}</div>}

      {/* Profil Daten */}
      <div style={s.card}>
        <h2 style={s.h2}>📋 {T('profile_personal_data')}</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Feld label={T('name')}>
              <input style={s.input} value={form.voller_name}
                onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} />
            </Feld>
            <Feld label={T('profile_phone')}>
              <input style={s.input} value={form.telefon} placeholder="+49 123 456789"
                onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
            </Feld>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Feld label={T('profile_birthday')}>
              <input type="date" style={s.input} value={form.geburtsdatum}
                onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} />
            </Feld>
            <Feld label={T('profile_address')}>
              <input style={s.input} value={form.adresse}
                onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
            </Feld>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={profilSpeichern} disabled={laden} style={s.btnPri}>
              {laden ? T('loading') : `💾 ${T('save')}`}
            </button>
          </div>
        </div>
      </div>

      {/* Dokumente */}
      <div style={s.card}>
        <h2 style={s.h2}>📁 {T('profile_documents')}</h2>
        {dateiLaden ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{T('loading')}</div>
        ) : dateien.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
            {T('profile_no_documents')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dateien.map(d => <DokumentZeile key={d.id} datei={d} T={T} />)}
          </div>
        )}
      </div>

      {/* E-Mail-Benachrichtigungen */}
      <div style={s.card}>
        <h2 style={s.h2}>{T('email_notifications_title')}</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { key: 'event_invite', label: T('notif_event_invite'), desc: T('notif_event_invite_desc') },
            { key: 'new_piece',    label: T('notif_new_piece'),    desc: T('notif_new_piece_desc') },
          ].map(opt => (
            <label key={opt.key} style={{ display:'flex', alignItems:'center', gap:14, cursor:'pointer', padding:'12px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: notifPrefs[opt.key] ? 'var(--bg-2)' : 'var(--bg)', transition:'background 0.15s' }}>
              <div style={{ position:'relative', flexShrink:0 }} onClick={e => { e.preventDefault(); setNotifPrefs(p => ({ ...p, [opt.key]: !p[opt.key] })) }}>
                <div style={{ width:42, height:24, borderRadius:99, background: notifPrefs[opt.key] ? 'var(--primary)' : 'var(--border)', position:'relative', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:3, left: notifPrefs[opt.key] ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.2)', transition:'left 0.2s' }} />
                </div>
              </div>
              <div onClick={() => setNotifPrefs(p => ({ ...p, [opt.key]: !p[opt.key] }))}>
                <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
        {notifErfolg && <div style={{ ...s.erfolg, marginTop:12 }}>{T('save')} ✓</div>}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={notifSpeichern} disabled={notifLaden} style={s.btnPri}>
            {notifLaden ? T('loading') : `💾 ${T('save')}`}
          </button>
        </div>
      </div>

      {/* Kalender-Abonnement */}
      <div style={s.card}>
        <h2 style={s.h2}>{T('ical_title')}</h2>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--text-3)', lineHeight:1.5 }}>{T('ical_desc')}</p>
        {kalTokenLaden ? (
          <div style={{ color:'var(--text-3)', fontSize:13 }}>{T('ical_loading')}</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Feld label={T('ical_url_label')}>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  readOnly
                  value={kalenderUrl}
                  style={{ ...s.input, color:'var(--text-3)', fontSize:12, flex:1 }}
                  onFocus={e => e.target.select()}
                />
                <button onClick={icalKopieren} style={{ ...s.btnPri, whiteSpace:'nowrap', flexShrink:0 }}>
                  {icalKopiert ? `✓ ${T('ical_copied')}` : T('ical_copy')}
                </button>
              </div>
            </Feld>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button
                onClick={() => { if (window.confirm(T('ical_reset_confirm'))) kalenderTokenNeu() }}
                style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
              >
                🔄 {T('ical_reset')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Passwort */}
      <div style={s.card}>
        <h2 style={s.h2}>🔑 {T('profile_change_password')}</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Feld label={T('profile_new_password')}>
            <input type="password" style={s.input} value={pw.neu} placeholder="Mindestens 6 Zeichen"
              onChange={e => setPw(p => ({ ...p, neu: e.target.value }))} />
          </Feld>
          <Feld label={T('profile_confirm_password')}>
            <input type="password" style={s.input} value={pw.neu2} placeholder="Wiederholen"
              onChange={e => setPw(p => ({ ...p, neu2: e.target.value }))} />
          </Feld>
          {pw.neu && pw.neu2 && pw.neu !== pw.neu2 && (
            <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>Passwörter stimmen nicht überein</p>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={passwortAendern} disabled={pwLaden || !pw.neu || pw.neu !== pw.neu2} style={s.btnPri}>
              {pwLaden ? 'Ändere …' : '🔑 Passwort ändern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Feld({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  h1:     { margin:'0 0 24px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  h2:     { margin:'0 0 16px', fontSize:16, fontWeight:800, color:'var(--text)' },
  card:   { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'20px 24px', border:'1px solid var(--border)', boxShadow:'var(--shadow)', marginBottom:16 },
  input:  { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%' },
  btnPri: { padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  erfolg: { padding:'12px 16px', borderRadius:'var(--radius)', background:'#d1fae5', color:'#065f46', fontWeight:600, fontSize:14, marginBottom:16 },
  fehler: { padding:'12px 16px', borderRadius:'var(--radius)', background:'#fee2e2', color:'var(--danger)', fontWeight:600, fontSize:14, marginBottom:16 },
}
