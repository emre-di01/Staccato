import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const ROLLEN = ['admin', 'lehrer', 'schueler', 'eltern']
const ROLLEN_FARBE = {
  admin:     { bg: 'var(--accent)',   text: 'var(--accent-fg)' },
  lehrer:    { bg: 'var(--primary)',  text: 'var(--primary-fg)' },
  schueler:  { bg: 'var(--success)',  text: '#fff' },
  eltern:    { bg: 'var(--warning)',  text: '#fff' },
  superadmin:{ bg: 'var(--danger)',   text: '#fff' },
}

// ─── UI Komponenten ───────────────────────────────────────────

function Badge({ rolle }) {
  const f = ROLLEN_FARBE[rolle] ?? { bg: 'var(--bg-3)', text: 'var(--text-2)' }
  return (
    <span style={{
      background: f.bg, color: f.text,
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>{rolle}</span>
  )
}

function Avatar({ name, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--primary)', color: 'var(--primary-fg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, flexShrink: 0,
      letterSpacing: '-0.5px',
    }}>
      {name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
    </div>
  )
}

function Modal({ titel, onClose, children, breit = false }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: '28px 32px', width: '100%', maxWidth: breit ? 600 : 460,
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Feld({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

// ─── Nutzer anlegen Modal ─────────────────────────────────────

function NutzerAnlegenModal({ onClose, onErfolg, T }) {
  const [form, setForm] = useState({ email: '', voller_name: '', passwort: '', rolle: 'schueler', telefon: '', geburtsdatum: '' })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function anlegen() {
    if (!form.email || !form.voller_name || !form.passwort) {
      setFehler('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setLaden(true)
    setFehler('')

    const { error } = await supabase.rpc('create_user', {
      p_email:       form.email,
      p_passwort:    form.passwort,
      p_voller_name: form.voller_name,
      p_rolle:       form.rolle,
    })

    if (error) {
      setFehler(error.message.includes('409') || error.message.includes('already')
        ? 'Diese E-Mail existiert bereits.'
        : error.message)
      setLaden(false)
      return
    }

    // Zusätzliche Felder updaten
    if (form.telefon || form.geburtsdatum) {
      const { data: u } = await supabase.from('profiles').select('id').eq('voller_name', form.voller_name).single()
      if (u) await supabase.from('profiles').update({ telefon: form.telefon, geburtsdatum: form.geburtsdatum || null }).eq('id', u.id)
    }

    setErfolg(true)
    setLaden(false)
    setTimeout(() => { onErfolg(); onClose() }, 1200)
  }

  return (
    <Modal titel="Neues Mitglied anlegen" onClose={onClose}>
      <div style={s.formGrid}>
        {erfolg ? (
          <div style={s.erfolg}>✅ Nutzer erfolgreich angelegt!</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Feld label="Vorname + Nachname *">
                <input style={s.input} placeholder="Max Mustermann" value={form.voller_name}
                  onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} />
              </Feld>
              <Feld label="Rolle">
                <select style={s.input} value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))}>
                  {ROLLEN.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </Feld>
            </div>
            <Feld label="E-Mail *">
              <input type="email" style={s.input} placeholder="max@beispiel.de" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Feld>
            <Feld label="Passwort *">
              <input type="password" style={s.input} placeholder="Mindestens 6 Zeichen" value={form.passwort}
                onChange={e => setForm(f => ({ ...f, passwort: e.target.value }))} />
            </Feld>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Feld label="Telefon">
                <input style={s.input} placeholder="+49 123 456789" value={form.telefon}
                  onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </Feld>
              <Feld label="Geburtsdatum">
                <input type="date" style={s.input} value={form.geburtsdatum}
                  onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} />
              </Feld>
            </div>
            {fehler && <p style={s.fehler}>{fehler}</p>}
            <div style={s.btnRow}>
              <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
              <button onClick={anlegen} disabled={laden} style={s.btnPri}>
                {laden ? 'Anlegen …' : '+ Mitglied anlegen'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Profil bearbeiten Modal ──────────────────────────────────

function ProfilModal({ mitglied, onClose, onErfolg, T }) {
  const [form, setForm] = useState({
    voller_name:  mitglied.voller_name ?? '',
    rolle:        mitglied.rolle ?? 'schueler',
    telefon:      mitglied.telefon ?? '',
    adresse:      mitglied.adresse ?? '',
    geburtsdatum: mitglied.geburtsdatum ?? '',
    notizen:      mitglied.notizen ?? '',
    aktiv:        mitglied.aktiv ?? true,
  })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    setLaden(true)
    const { error } = await supabase.from('profiles').update(form).eq('id', mitglied.id)
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <Modal titel={`Profil – ${mitglied.voller_name}`} onClose={onClose} breit>
      <div style={s.formGrid}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Feld label="Name">
            <input style={s.input} value={form.voller_name} onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} />
          </Feld>
          <Feld label="Rolle">
            <select style={s.input} value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))}>
              {ROLLEN.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </Feld>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Feld label="Telefon">
            <input style={s.input} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
          </Feld>
          <Feld label="Geburtsdatum">
            <input type="date" style={s.input} value={form.geburtsdatum}
              onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} />
          </Feld>
        </div>
        <Feld label="Adresse">
          <input style={s.input} value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
        </Feld>
        <Feld label="Interne Notizen">
          <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} value={form.notizen}
            onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
        </Feld>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="aktiv" checked={form.aktiv} onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))} />
          <label htmlFor="aktiv" style={s.label}>Aktiv</label>
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? 'Speichere …' : '💾 Speichern'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Lehrer-Schüler Zuordnung Modal ──────────────────────────

function ZuordnungModal({ mitglied, onClose, T }) {
  const [lehrer,    setLehrer]    = useState([])
  const [schueler,  setSchueler]  = useState([])
  const [zuordnung, setZuordnung] = useState([])
  const [unterricht, setUnterricht] = useState([])
  const [laden,     setLaden]     = useState(true)

  useEffect(() => {
    async function init() {
      const [l, sc, u] = await Promise.all([
        supabase.from('profiles').select('id, voller_name').eq('rolle', 'lehrer').eq('aktiv', true).order('voller_name'),
        supabase.from('profiles').select('id, voller_name').eq('rolle', 'schueler').eq('aktiv', true).order('voller_name'),
        supabase.from('unterricht').select('id, name, typ, unterricht_lehrer(lehrer_id), unterricht_schueler(schueler_id)'),
      ])
      setLehrer(l.data ?? [])
      setSchueler(sc.data ?? [])
      setUnterricht(u.data ?? [])
      setLaden(false)
    }
    init()
  }, [mitglied.id])

  const istLehrer = mitglied.rolle === 'lehrer'
  const liste = istLehrer ? schueler : lehrer

  // Unterrichte wo dieses Mitglied dabei ist
  const meineUnterricht = unterricht.filter(u =>
    istLehrer
      ? u.unterricht_lehrer?.some(ul => ul.lehrer_id === mitglied.id)
      : u.unterricht_schueler?.some(us => us.schueler_id === mitglied.id)
  )

  if (laden) return <Modal titel="Zuordnungen" onClose={onClose}><p style={{ color: 'var(--text-3)' }}>Laden …</p></Modal>

  return (
    <Modal titel={`Zuordnungen – ${mitglied.voller_name}`} onClose={onClose} breit>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Aktuelle Unterrichte */}
        <div>
          <div style={s.sectionLabel}>Aktuelle Unterrichte</div>
          {meineUnterricht.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Noch keinem Unterricht zugeordnet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {meineUnterricht.map(u => (
                <div key={u.id} style={{
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>
                    {u.typ === 'chor' ? '🎼' : u.typ === 'gruppe' ? '👥' : u.typ === 'ensemble' ? '🎻' : '🎵'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{u.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize', marginLeft: 'auto' }}>{u.typ}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
            💡 Lehrer-Schüler Zuordnungen werden über die <strong>Unterrichtsverwaltung</strong> gesteuert.
            Dort kannst du einem Unterricht Lehrer und Schüler hinzufügen.
          </p>
        </div>

        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnPri}>Fertig</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Löschen Bestätigung Modal ────────────────────────────────

function LoeschenModal({ mitglied, onClose, onErfolg }) {
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function loeschen() {
    setLaden(true)
    // Profil löschen (cascaded auf auth.users via RLS)
    const { error } = await supabase.from('profiles').delete().eq('id', mitglied.id)
    if (error) {
      setFehler(error.message)
      setLaden(false)
      return
    }
    onErfolg()
    onClose()
  }

  return (
    <Modal titel="Mitglied löschen" onClose={onClose}>
      <div style={s.formGrid}>
        <div style={{ padding:'16px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', color:'var(--danger)', fontSize:14 }}>
          ⚠️ Bist du sicher, dass du <strong>{mitglied.voller_name}</strong> löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={loeschen} disabled={laden}
            style={{ ...s.btnPri, background:'var(--danger)' }}>
            {laden ? 'Lösche …' : '🗑 Endgültig löschen'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────

export default function Mitgliederverwaltung() {
  const { T } = useApp()
  const [mitglieder,  setMitglieder]  = useState([])
  const [laden,       setLaden]       = useState(true)
  const [suche,       setSuche]       = useState('')
  const [filterRolle, setFilterRolle] = useState('alle')
  const [filterAktiv, setFilterAktiv] = useState('alle')
  const [modal,       setModal]       = useState(null)

  const ladeMitglieder = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('voller_name')
    setMitglieder(data ?? [])
    setLaden(false)
  }, [])

  useEffect(() => { ladeMitglieder() }, [ladeMitglieder])

  const gefiltert = mitglieder.filter(m => {
    const suchPasst = m.voller_name?.toLowerCase().includes(suche.toLowerCase())
    const rollePasst = filterRolle === 'alle' || m.rolle === filterRolle
    const aktivPasst = filterAktiv === 'alle' || (filterAktiv === 'aktiv' ? m.aktiv : !m.aktiv)
    return suchPasst && rollePasst && aktivPasst
  })

  // Statistiken
  const stats = {
    gesamt:   mitglieder.length,
    lehrer:   mitglieder.filter(m => m.rolle === 'lehrer').length,
    schueler: mitglieder.filter(m => m.rolle === 'schueler').length,
    eltern:   mitglieder.filter(m => m.rolle === 'eltern').length,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={s.h1}>👥 {T('members')}</h1>
          <p style={s.sub}>{stats.gesamt} Mitglieder · {stats.lehrer} Lehrer · {stats.schueler} Schüler</p>
        </div>
        <button onClick={() => setModal({ typ: 'anlegen' })} style={s.btnPri}>
          + Mitglied anlegen
        </button>
      </div>

      {/* Stats Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Alle', wert: stats.gesamt, key: 'alle' },
          { label: 'Lehrer', wert: stats.lehrer, key: 'lehrer' },
          { label: 'Schüler', wert: stats.schueler, key: 'schueler' },
          { label: 'Eltern', wert: stats.eltern, key: 'eltern' },
          { label: 'Admin', wert: mitglieder.filter(m => m.rolle === 'admin').length, key: 'admin' },
        ].map(item => (
          <button key={item.key} onClick={() => setFilterRolle(item.key)}
            style={{
              padding: '6px 14px', borderRadius: 99,
              border: '1.5px solid var(--border)',
              background: filterRolle === item.key ? 'var(--primary)' : 'var(--surface)',
              color: filterRolle === item.key ? 'var(--primary-fg)' : 'var(--text-2)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {item.label} {item.wert > 0 && <span style={{ opacity: 0.7 }}>({item.wert})</span>}
          </button>
        ))}
      </div>

      {/* Suche */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="🔍 Name suchen …"
          value={suche}
          onChange={e => setSuche(e.target.value)}
          style={{ ...s.input, flex: 1, maxWidth: 340 }}
        />
        <select style={{ ...s.input, width: 'auto' }} value={filterAktiv} onChange={e => setFilterAktiv(e.target.value)}>
          <option value="alle">Alle Status</option>
          <option value="aktiv">Aktiv</option>
          <option value="inaktiv">Inaktiv</option>
        </select>
      </div>

      {/* Tabelle / Karten */}
      {laden ? (
        <div style={s.leer}>Lade Mitglieder …</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>Keine Mitglieder gefunden.</div>
      ) : (
        <>
          {/* Desktop Tabelle */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }} className="desktop-table">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  {['Mitglied', 'Rolle', 'Telefon', 'Geburtstag', 'Status', 'Aktionen'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gefiltert.map((m, i) => (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.voller_name} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{m.voller_name}</div>
                          {m.notizen && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>📝 hat Notizen</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><Badge rolle={m.rolle} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>{m.telefon ?? '–'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                      {m.geburtsdatum ? new Date(m.geburtsdatum).toLocaleDateString('de-DE') : '–'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.aktiv ? 'var(--success)' : 'var(--danger)' }}>
                        {m.aktiv ? '● Aktiv' : '○ Inaktiv'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setModal({ typ: 'profil', mitglied: m })} style={s.btnKlein} title="Bearbeiten">✏️</button>
                        {(m.rolle === 'lehrer' || m.rolle === 'schueler') && (
                          <button onClick={() => setModal({ typ: 'zuordnung', mitglied: m })} style={s.btnKlein} title="Zuordnungen">🔗</button>
                        )}
                        <button onClick={() => setModal({ typ: 'loeschen', mitglied: m })} style={{ ...s.btnKlein, color:'var(--danger)' }} title="Löschen">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Karten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="mobile-cards">
            {gefiltert.map(m => (
              <div key={m.id} style={{
                background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                padding: '16px', border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Avatar name={m.voller_name} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{m.voller_name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <Badge rolle={m.rolle} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.aktiv ? 'var(--success)' : 'var(--danger)' }}>
                        {m.aktiv ? '● Aktiv' : '○ Inaktiv'}
                      </span>
                    </div>
                  </div>
                </div>
                {m.telefon && <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>📞 {m.telefon}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setModal({ typ: 'profil', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                    ✏️ Bearbeiten
                  </button>
                  {(m.rolle === 'lehrer' || m.rolle === 'schueler') && (
                    <button onClick={() => setModal({ typ: 'zuordnung', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                      🔗 Zuordnungen
                    </button>
                  )}
                  <button onClick={() => setModal({ typ: 'loeschen', mitglied: m })} style={{ ...s.btnSek, fontSize: 13, color:'var(--danger)', borderColor:'var(--danger)' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {modal?.typ === 'anlegen'   && <NutzerAnlegenModal onClose={() => setModal(null)} onErfolg={ladeMitglieder} T={T} />}
      {modal?.typ === 'profil'    && <ProfilModal mitglied={modal.mitglied} onClose={() => setModal(null)} onErfolg={ladeMitglieder} T={T} />}
      {modal?.typ === 'zuordnung' && <ZuordnungModal mitglied={modal.mitglied} onClose={() => setModal(null)} T={T} />}
      {modal?.typ === 'loeschen'  && (
        <LoeschenModal
          mitglied={modal.mitglied}
          onClose={() => setModal(null)}
          onErfolg={ladeMitglieder}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-table { display: none !important; }
          .mobile-cards { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-cards { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  h1:         { margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' },
  sub:        { margin: 0, color: 'var(--text-3)', fontSize: 14 },
  label:      { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  input:      { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%', transition: 'border-color 0.15s' },
  btnPri:     { padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', whiteSpace: 'nowrap' },
  btnSek:     { padding: '10px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  btnKlein:   { padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' },
  iconBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)', padding: 4 },
  leer:       { padding: '64px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' },
  formGrid:   { display: 'flex', flexDirection: 'column', gap: 16 },
  btnRow:     { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  fehler:     { margin: 0, color: 'var(--danger)', fontSize: 13 },
  erfolg:     { padding: '16px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', color: 'var(--success)', fontWeight: 700, textAlign: 'center' },
}
