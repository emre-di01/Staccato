import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import OrtAutocomplete from '../components/OrtAutocomplete'

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
  const { profil, ladeProfil, T, confirm } = useApp()
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

  // MFA
  const [mfaFaktoren,   setMfaFaktoren]   = useState([])
  const [mfaPhase,      setMfaPhase]      = useState('idle') // idle | enrolling | verifying
  const [mfaEnrollData, setMfaEnrollData] = useState(null)
  const [mfaCode,       setMfaCode]       = useState('')
  const [mfaLaden,      setMfaLaden]      = useState(false)

  const [loeschModal,  setLoeschModal]  = useState(false)
  const [loeschInput,  setLoeschInput]  = useState('')
  const [loeschLaden,  setLoeschLaden]  = useState(false)
  const [exportLaden,  setExportLaden]  = useState(false)

  async function ladeMfaFaktoren() {
    const { data } = await supabase.auth.mfa.listFactors()
    setMfaFaktoren(data?.totp?.filter(f => f.status === 'verified') ?? [])
  }

  async function mfaAktivieren() {
    setMfaLaden(true); setFehler('')
    // Unverifizierte Altfaktoren bereinigen
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.totp ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp', issuer: 'Staccato',
      friendlyName: profil?.voller_name ?? 'Staccato',
    })
    if (error) { setFehler(error.message); setMfaLaden(false); return }
    setMfaEnrollData(data)
    setMfaPhase('verifying')
    setMfaLaden(false)
  }

  async function mfaBestätigen(e) {
    e.preventDefault()
    setMfaLaden(true); setFehler('')
    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.id })
    if (ce) { setFehler(ce.message); setMfaLaden(false); return }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaEnrollData.id, challengeId: challenge.id,
      code: mfaCode.replace(/\s/g, ''),
    })
    if (error) { setFehler('Ungültiger Code – bitte erneut versuchen.'); setMfaLaden(false); return }
    setMfaPhase('idle'); setMfaCode(''); setMfaEnrollData(null)
    await ladeMfaFaktoren()
    setErfolg('Zwei-Faktor-Authentifizierung aktiviert!')
    setMfaLaden(false)
  }

  async function mfaDeaktivieren(factorId) {
    setMfaLaden(true)
    await supabase.auth.mfa.unenroll({ factorId })
    await ladeMfaFaktoren()
    setErfolg('Zwei-Faktor-Authentifizierung deaktiviert.')
    setMfaLaden(false)
  }

  useEffect(() => {
    if (!profil?.id) return
    supabase.from('mitglied_dateien')
      .select('*').eq('profil_id', profil.id).order('hochgeladen_am', { ascending: false })
      .then(({ data }) => { setDateien(data ?? []); setDateiLaden(false) })
    ladeMfaFaktoren()
  }, [profil?.id])

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

  function validierePasswort(p) {
    if (p.length < 8 || !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p))
      return 'Passwort muss mindestens 8 Zeichen haben und Groß-/Kleinbuchstaben sowie eine Zahl enthalten.'
    return null
  }

  async function passwortAendern() {
    if (!pw.neu || pw.neu !== pw.neu2) { setFehler('Passwörter stimmen nicht überein.'); return }
    const err = validierePasswort(pw.neu)
    if (err) { setFehler(err); return }
    setPwLaden(true); setFehler(''); setErfolg('')
    const { error } = await supabase.auth.updateUser({ password: pw.neu })
    if (error) setFehler(error.message)
    else { setErfolg('Passwort geändert!'); setPw({ alt:'', neu:'', neu2:'' }) }
    setPwLaden(false)
  }

  async function avatarHochladen(e) {
    const datei = e.target.files[0]
    if (!datei) return
    if (datei.size > 15 * 1024 * 1024) { setFehler('Datei zu groß (max. 15 MB).'); return }
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

  async function datenExportieren() {
    setExportLaden(true)
    const { data, error } = await supabase.rpc('meine_daten_exportieren')
    if (error) { setFehler('Export fehlgeschlagen: ' + error.message); setExportLaden(false); return }
    if (!data) { setFehler('Keine Daten erhalten.'); setExportLaden(false); return }
    const json = JSON.stringify(data, null, 2)
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json)
    const a = document.createElement('a')
    a.setAttribute('href', dataUrl)
    a.setAttribute('download', `staccato-daten-${new Date().toISOString().slice(0,10)}.json`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setExportLaden(false)
  }

  async function kontoLoeschen() {
    setLoeschLaden(true)
    // Avatar aus Storage löschen
    if (profil?.avatar_url) {
      const match = profil.avatar_url.split('?')[0].match(/\/avatare\/(.+)$/)
      if (match) await supabase.storage.from('avatare').remove([decodeURIComponent(match[1])])
    }
    const { error } = await supabase.rpc('mein_konto_loeschen')
    if (error) {
      setFehler('Löschen fehlgeschlagen: ' + error.message)
      setLoeschLaden(false)
      setLoeschModal(false)
      return
    }
    await supabase.auth.signOut()
    window.location.href = '/'
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
          </div>
          <Feld label={T('profile_address')}>
            <OrtAutocomplete
              value={form.adresse}
              onChange={v => setForm(f => ({ ...f, adresse: v }))}
              inputStyle={s.input}
            />
          </Feld>
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

      {/* Passwort */}
      <div style={s.card}>
        <h2 style={s.h2}>🔑 {T('profile_change_password')}</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Feld label={T('profile_new_password')}>
            <input type="password" style={s.input} value={pw.neu} placeholder="Mind. 8 Zeichen, Groß/Klein + Zahl"
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

      {/* 2FA */}
      <div style={s.card}>
        <h2 style={s.h2}>🛡️ Zwei-Faktor-Authentifizierung</h2>

        {mfaPhase === 'idle' && (
          mfaFaktoren.length === 0 ? (
            <>
              <p style={{ margin:'0 0 16px', fontSize:14, color:'var(--text-2)', lineHeight:1.6 }}>
                Erhöhe die Sicherheit deines Kontos mit einer Authenticator-App (z. B. Google Authenticator oder Authy).
              </p>
              <button onClick={mfaAktivieren} disabled={mfaLaden} style={s.btnPri}>
                {mfaLaden ? 'Vorbereiten …' : '🛡️ 2FA aktivieren'}
              </button>
            </>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>2FA ist aktiviert</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{mfaFaktoren[0].friendly_name}</div>
                </div>
              </div>
              <button onClick={() => mfaDeaktivieren(mfaFaktoren[0].id)} disabled={mfaLaden}
                style={{ ...s.btnPri, background:'var(--danger)', color:'#fff' }}>
                {mfaLaden ? '…' : 'Deaktivieren'}
              </button>
            </div>
          )
        )}

        {mfaPhase === 'verifying' && mfaEnrollData && (
          <form onSubmit={mfaBestätigen} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <p style={{ margin:0, fontSize:14, color:'var(--text-2)', lineHeight:1.6 }}>
              Scanne diesen QR-Code mit deiner Authenticator-App und gib dann den 6-stelligen Code ein.
            </p>
            <div style={{ display:'flex', justifyContent:'center' }}>
              <img src={mfaEnrollData.totp.qr_code} alt="QR-Code"
                style={{ width:180, height:180, borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:8, background:'#fff' }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
              <code style={{ flex:1, fontSize:12, letterSpacing:'0.08em', color:'var(--text)', wordBreak:'break-all' }}>
                {mfaEnrollData.totp.secret}
              </code>
              <button type="button"
                onClick={() => navigator.clipboard.writeText(mfaEnrollData.totp.secret)}
                style={{ flexShrink:0, padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                Kopieren
              </button>
            </div>
            <Feld label="6-stelliger Code aus der App">
              <input
                style={{ ...s.input, letterSpacing:'0.2em', fontSize:20, textAlign:'center' }}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000 000"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              />
            </Feld>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button"
                onClick={() => { setMfaPhase('idle'); setMfaEnrollData(null); setMfaCode('') }}
                style={{ ...s.btnPri, background:'var(--border)', color:'var(--text)' }}>
                Abbrechen
              </button>
              <button type="submit" disabled={mfaLaden || mfaCode.length !== 6} style={s.btnPri}>
                {mfaLaden ? 'Prüfe …' : '✓ Bestätigen'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Datenschutz / DSGVO */}
      <div style={s.card}>
        <h2 style={s.h2}>🔒 Meine Daten (DSGVO Art. 15)</h2>
        <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6, margin:'0 0 16px' }}>
          Du hast das Recht, eine Kopie aller über dich gespeicherten personenbezogenen Daten zu erhalten.
        </p>
        <button onClick={datenExportieren} disabled={exportLaden} style={s.btnPri}>
          {exportLaden ? 'Exportiere …' : '⬇ Daten herunterladen'}
        </button>
      </div>

      {/* Konto löschen */}
      <div style={{ ...s.card, borderColor:'var(--danger)' }}>
        <h2 style={{ ...s.h2, color:'var(--danger)' }}>⚠️ Konto löschen</h2>
        <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6, margin:'0 0 16px' }}>
          Hiermit löschst du dein Konto und alle zugehörigen personenbezogenen Daten unwiderruflich
          (gemäß Art. 17 DSGVO). Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <button onClick={() => { setLoeschModal(true); setLoeschInput('') }}
          style={{ ...s.btnPri, background:'transparent', color:'var(--danger)', border:'1.5px solid var(--danger)' }}>
          Konto löschen
        </button>
      </div>

      {/* Lösch-Bestätigungs-Modal */}
      {loeschModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 28px 24px', maxWidth:420, width:'100%', boxShadow:'var(--shadow-lg)' }}>
            <h2 style={{ margin:'0 0 12px', fontSize:18, fontWeight:800, color:'var(--danger)' }}>Konto unwiderruflich löschen</h2>
            <p style={{ margin:'0 0 20px', fontSize:14, color:'var(--text-2)', lineHeight:1.6 }}>
              Alle deine Daten werden sofort und dauerhaft gelöscht. Du wirst automatisch abgemeldet.
            </p>
            <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:'var(--text)' }}>
              Tippe <strong>LÖSCHEN</strong> zur Bestätigung:
            </p>
            <input
              style={{ ...s.input, marginBottom:20 }}
              value={loeschInput}
              onChange={e => setLoeschInput(e.target.value)}
              placeholder="LÖSCHEN"
              autoFocus
            />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setLoeschModal(false)} disabled={loeschLaden}
                style={{ ...s.btnPri, background:'var(--border)', color:'var(--text)' }}>
                Abbrechen
              </button>
              <button onClick={kontoLoeschen}
                disabled={loeschInput !== 'LÖSCHEN' || loeschLaden}
                style={{ ...s.btnPri, background:'var(--danger)', color:'#fff', opacity: loeschInput !== 'LÖSCHEN' ? 0.5 : 1 }}>
                {loeschLaden ? 'Lösche …' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
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
