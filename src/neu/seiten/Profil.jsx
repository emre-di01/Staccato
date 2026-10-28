import { useEffect, useRef, useState } from 'react'
import { Camera, KeyRound, ShieldCheck, Download, UserX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import OrtAutocomplete from '../../components/OrtAutocomplete'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Knopf, Blatt, Feld, eingabeStil } from '../../ui'

export default function NeuProfil() {
  const { profil, ladeProfil, T, toast, confirm } = useApp()
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    voller_name:  profil?.voller_name  ?? '',
    telefon:      profil?.telefon      ?? '',
    adresse:      profil?.adresse      ?? '',
    geburtsdatum: profil?.geburtsdatum ?? '',
  })
  const [speichert, setSpeichert] = useState(false)
  const [bildLaedt, setBildLaedt] = useState(false)
  const [blatt, setBlatt] = useState(null)   // 'passwort' | 'zweifaktor' | 'loeschen'
  const [exportiert, setExportiert] = useState(false)

  const geaendert = ['voller_name', 'telefon', 'adresse', 'geburtsdatum'].some(k => (form[k] ?? '') !== (profil?.[k] ?? ''))

  async function speichern() {
    if (!form.voller_name.trim()) { toast(T('n_name_fehlt'), 'error'); return }
    setSpeichert(true)
    const { error } = await supabase.from('profiles').update({ ...form, voller_name: form.voller_name.trim(), geburtsdatum: form.geburtsdatum || null }).eq('id', profil.id)
    setSpeichert(false)
    if (error) { toast(error.message, 'error'); return }
    await ladeProfil(profil.id)
    toast(T('profile_saved'), 'success')
  }

  function avatarPfad(url) {
    const m = url?.split('?')[0].match(/\/avatare\/(.+)$/)
    return m ? decodeURIComponent(m[1]) : null
  }

  async function bildHochladen(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (!datei) return
    if (datei.size > 5 * 1024 * 1024) { toast(T('file_too_large').replace('{n}', 5), 'error'); return }
    setBildLaedt(true)
    const pfad = `${profil.id}/avatar_${Date.now()}_${datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('avatare').upload(pfad, datei, { upsert: true })
    if (upErr) { setBildLaedt(false); toast(upErr.message, 'error'); return }
    const alt = avatarPfad(profil.avatar_url)
    const { data } = supabase.storage.from('avatare').getPublicUrl(pfad)
    const { error } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profil.id)
    if (error) { setBildLaedt(false); toast(error.message, 'error'); return }
    if (alt) await supabase.storage.from('avatare').remove([alt])
    await ladeProfil(profil.id)
    setBildLaedt(false)
  }

  async function bildEntfernen() {
    const ok = await confirm(T('n_foto_entfernen_frage'), { confirmLabel: T('n_foto_entfernen') })
    if (!ok) return
    setBildLaedt(true)
    const alt = avatarPfad(profil.avatar_url)
    if (alt) await supabase.storage.from('avatare').remove([alt])
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profil.id)
    if (error) toast(error.message, 'error')
    await ladeProfil(profil.id)
    setBildLaedt(false)
  }

  async function datenExportieren() {
    setExportiert(true)
    const { data, error } = await supabase.rpc('meine_daten_exportieren')
    setExportiert(false)
    if (error || !data) { toast(error?.message ?? T('n_fehler'), 'error'); return }
    const a = document.createElement('a')
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2))
    a.download = `staccato-daten-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const name = profil?.voller_name ?? ''

  return (
    <Seite titel={T('profile_title')} zurueck={{ to: '/schueler/ich', label: T('n_tab_ich') }}>
      {/* Foto */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 112, height: 112, borderRadius: 56, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 700, overflow: 'hidden', opacity: bildLaedt ? 0.5 : 1 }}>
          {profil?.avatar_url ? <img src={profil.avatar_url} alt={T('n_profilfoto')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name[0] ?? '?').toUpperCase()}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={bildHochladen} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Knopf klein variante="tint" icon={Camera} onClick={() => fileRef.current?.click()} disabled={bildLaedt}>{profil?.avatar_url ? T('n_foto_aendern') : T('n_foto_hinzufuegen')}</Knopf>
          {profil?.avatar_url && <Knopf klein variante="sekundaer" onClick={bildEntfernen} disabled={bildLaedt}>{T('n_foto_entfernen')}</Knopf>}
        </div>
      </div>

      {/* Persönliche Daten */}
      <Abschnitt titel={T('profile_personal_data')}>
        <Gruppe style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Feld label={T('name')}>
            <input value={form.voller_name} onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} autoComplete="name" style={eingabeStil} />
          </Feld>
          <Feld label={T('profile_phone')}>
            <input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} type="tel" autoComplete="tel" placeholder="+49 …" style={eingabeStil} />
          </Feld>
          <Feld label={T('profile_birthday')}>
            <input value={form.geburtsdatum} onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} type="date" style={eingabeStil} />
          </Feld>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{T('profile_address')}</span>
            <OrtAutocomplete value={form.adresse} onChange={v => setForm(f => ({ ...f, adresse: v }))} inputStyle={eingabeStil} />
          </div>
          <Knopf voll onClick={speichern} disabled={speichert || !geaendert}>{speichert ? T('loading') : T('save')}</Knopf>
        </Gruppe>
      </Abschnitt>

      {/* Sicherheit */}
      <Abschnitt titel={T('n_sicherheit')}>
        <Gruppe>
          <Zeile icon={KeyRound} titel={T('profile_change_password')} onClick={() => setBlatt('passwort')} />
          <Trenner />
          <Zeile icon={ShieldCheck} titel={T('n_zweifaktor')} untertitel={T('n_zweifaktor_kurz')} onClick={() => setBlatt('zweifaktor')} />
        </Gruppe>
      </Abschnitt>

      {/* Datenschutz */}
      <Abschnitt titel={T('n_datenschutz')}>
        <Gruppe>
          <Zeile icon={Download} titel={exportiert ? T('loading') : T('n_daten_herunterladen')} untertitel={T('n_daten_herunterladen_info')} onClick={exportiert ? undefined : datenExportieren} />
          <Trenner />
          <Zeile icon={UserX} iconFarbe="var(--danger)" titel={T('n_konto_loeschen')} onClick={() => setBlatt('loeschen')} />
        </Gruppe>
      </Abschnitt>

      {blatt === 'passwort' && <PasswortBlatt onClose={() => setBlatt(null)} />}
      {blatt === 'zweifaktor' && <ZweiFaktorBlatt onClose={() => setBlatt(null)} />}
      {blatt === 'loeschen' && <LoeschenBlatt onClose={() => setBlatt(null)} />}
    </Seite>
  )
}

function PasswortBlatt({ onClose }) {
  const { T, toast } = useApp()
  const [pw, setPw] = useState({ neu: '', neu2: '' })
  const [laedt, setLaedt] = useState(false)
  const zuSchwach = pw.neu && (pw.neu.length < 8 || !/[A-Z]/.test(pw.neu) || !/[a-z]/.test(pw.neu) || !/[0-9]/.test(pw.neu))
  const ungleich = pw.neu2 && pw.neu !== pw.neu2

  async function aendern() {
    setLaedt(true)
    const { error } = await supabase.auth.updateUser({ password: pw.neu })
    setLaedt(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('profile_pw_changed_short'), 'success')
    onClose()
  }

  return (
    <Blatt titel={T('profile_change_password')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('profile_new_password')} hinweis={zuSchwach ? <span style={{ color: 'var(--danger)' }}>{T('n_pw_regeln')}</span> : T('n_pw_regeln')}>
          <input type="password" autoComplete="new-password" value={pw.neu} onChange={e => setPw(p => ({ ...p, neu: e.target.value }))} style={eingabeStil} />
        </Feld>
        <Feld label={T('profile_confirm_password')} hinweis={ungleich ? <span style={{ color: 'var(--danger)' }}>{T('n_pw_ungleich')}</span> : null}>
          <input type="password" autoComplete="new-password" value={pw.neu2} onChange={e => setPw(p => ({ ...p, neu2: e.target.value }))} style={eingabeStil} />
        </Feld>
        <Knopf voll onClick={aendern} disabled={laedt || !pw.neu || zuSchwach || pw.neu !== pw.neu2}>{laedt ? T('loading') : T('profile_change_password')}</Knopf>
      </div>
    </Blatt>
  )
}

function ZweiFaktorBlatt({ onClose }) {
  const { profil, T, toast, confirm } = useApp()
  const [faktoren, setFaktoren] = useState(null)
  const [einrichtung, setEinrichtung] = useState(null)   // Antwort von mfa.enroll
  const [code, setCode] = useState('')
  const [laedt, setLaedt] = useState(false)

  async function laden() {
    const { data } = await supabase.auth.mfa.listFactors()
    setFaktoren(data?.totp?.filter(f => f.status === 'verified') ?? [])
  }
  useEffect(() => { laden() }, [])

  async function starten() {
    setLaedt(true)
    // Unbestätigte Altfaktoren bereinigen
    const { data: vorhanden } = await supabase.auth.mfa.listFactors()
    for (const f of vorhanden?.totp ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Staccato', friendlyName: profil?.voller_name ?? 'Staccato' })
    setLaedt(false)
    if (error) { toast(error.message, 'error'); return }
    setEinrichtung(data)
  }

  async function bestaetigen() {
    setLaedt(true)
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: einrichtung.id })
    if (ce) { setLaedt(false); toast(ce.message, 'error'); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: einrichtung.id, challengeId: ch.id, code })
    setLaedt(false)
    if (error) { toast(T('n_code_falsch'), 'error'); return }
    toast(T('n_zweifaktor_an'), 'success')
    setEinrichtung(null); setCode('')
    laden()
  }

  async function ausschalten(f) {
    const ok = await confirm(T('n_zweifaktor_aus_frage'), { confirmLabel: T('n_ausschalten') })
    if (!ok) return
    setLaedt(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    setLaedt(false)
    if (error) { toast(error.message, 'error'); return }
    laden()
  }

  const text = { fontSize: 17, lineHeight: 1.5, margin: 0 }
  return (
    <Blatt titel={T('n_zweifaktor')} onClose={onClose}>
      {faktoren === null ? <p style={text}>{T('loading')}</p>
        : einrichtung ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={text}>{T('n_zweifaktor_scannen')}</p>
            <img src={einrichtung.totp.qr_code} alt={T('n_qr_code')} style={{ alignSelf: 'center', width: 200, height: 200, padding: 10, borderRadius: 14, background: '#FFFFFF' }} />
            <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('n_zweifaktor_schluessel')}</div>
            <code style={{ padding: 12, borderRadius: 12, background: 'var(--n-fill)', fontSize: 15, letterSpacing: '0.08em', overflowWrap: 'anywhere' }}>{einrichtung.totp.secret}</code>
            <Feld label={T('n_code_aus_app')}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                style={{ ...eingabeStil, fontSize: 24, letterSpacing: '0.3em', textAlign: 'center' }} />
            </Feld>
            <Knopf voll onClick={bestaetigen} disabled={laedt || code.length !== 6}>{laedt ? T('loading') : T('n_bestaetigen')}</Knopf>
          </div>
        ) : faktoren.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={text}>{T('n_zweifaktor_ist_an')}</p>
            <Knopf voll variante="gefahr" onClick={() => ausschalten(faktoren[0])} disabled={laedt}>{T('n_ausschalten')}</Knopf>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={text}>{T('n_zweifaktor_erklaerung')}</p>
            <Knopf voll icon={ShieldCheck} onClick={starten} disabled={laedt}>{laedt ? T('loading') : T('n_einschalten')}</Knopf>
          </div>
        )}
    </Blatt>
  )
}

function LoeschenBlatt({ onClose }) {
  const { profil, T, toast } = useApp()
  const [eingabe, setEingabe] = useState('')
  const [laedt, setLaedt] = useState(false)
  const wort = T('n_loeschen_wort')

  async function loeschen() {
    setLaedt(true)
    const m = profil?.avatar_url?.split('?')[0].match(/\/avatare\/(.+)$/)
    if (m) await supabase.storage.from('avatare').remove([decodeURIComponent(m[1])])
    const { error } = await supabase.rpc('mein_konto_loeschen')
    if (error) { setLaedt(false); toast(error.message, 'error'); return }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <Blatt titel={T('n_konto_loeschen')} onClose={() => !laedt && onClose()}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 17, lineHeight: 1.5, margin: 0 }}>{T('n_konto_loeschen_text')}</p>
        <Feld label={T('n_loeschen_tippen').replace('{wort}', wort)}>
          <input value={eingabe} onChange={e => setEingabe(e.target.value)} autoComplete="off" style={eingabeStil} />
        </Feld>
        <Knopf voll variante="gefahr" onClick={loeschen} disabled={laedt || eingabe.trim().toUpperCase() !== wort.toUpperCase()}>{laedt ? T('loading') : T('n_endgueltig_loeschen')}</Knopf>
        <Knopf voll variante="sekundaer" onClick={onClose} disabled={laedt}>{T('cancel')}</Knopf>
      </div>
    </Blatt>
  )
}
