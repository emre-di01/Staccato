import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'

export default function SuperadminDemos() {
  const { toast, confirm } = useApp()
  const [tab, setTab]                 = useState('anfragen')
  const [anfragen, setAnfragen]       = useState([])
  const [demos, setDemos]             = useState([])
  const [laden, setLaden]             = useState(true)
  const [aktion, setAktion]           = useState(null)  // { id, typ }
  const [ablehnModal, setAblehnModal] = useState(null)

  useEffect(() => { ladeAlles() }, [])

  async function ladeAlles() {
    setLaden(true)
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from('demo_anfragen').select('*').eq('status', 'ausstehend').order('erstellt_am', { ascending: false }),
      supabase.from('demo_anfragen').select('*, schulen(id, name, demo_expires_at)').eq('status', 'genehmigt').order('genehmigt_am', { ascending: false }),
    ])
    setAnfragen(a ?? [])
    setDemos(d ?? [])
    setLaden(false)
  }

  async function handleGenehmigen(anfrage) {
    const ok = await confirm(`Demo für „${anfrage.schul_name}" genehmigen und Zugangsdaten an ${anfrage.email} senden?`, { confirmLabel: 'Genehmigen', dangerous: false })
    if (!ok) return
    setAktion({ id: anfrage.id, typ: 'genehmigen' })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-genehmigen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ anfrage_id: anfrage.id }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Fehler') }
      toast('Demo genehmigt – Zugangsdaten wurden gesendet.', 'success')
      await ladeAlles()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setAktion(null)
    }
  }

  async function handleAblehnen(anfrage) {
    setAktion({ id: anfrage.id, typ: 'ablehnen' })
    await supabase.from('demo_anfragen').update({ status: 'abgelehnt' }).eq('id', anfrage.id)
    setAblehnModal(null)
    toast('Anfrage abgelehnt.', 'info')
    setAktion(null)
    await ladeAlles()
  }

  async function handleVerlaengern(schule) {
    const neu = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('schulen').update({ demo_expires_at: neu }).eq('id', schule.id)
    toast('+7 Tage hinzugefügt.', 'success')
    await ladeAlles()
  }

  async function handleLoeschen(demo) {
    const ok = await confirm(`Demo-Schule „${demo.schulen?.name}" und alle Accounts unwiderruflich löschen?`, { confirmLabel: 'Löschen' })
    if (!ok) return
    setAktion({ id: demo.id, typ: 'loeschen' })
    const { error } = await supabase.rpc('demo_schule_loeschen', { p_schule_id: demo.schulen?.id })
    if (error) { toast(error.message, 'error') } else { toast('Demo gelöscht.', 'success'); await ladeAlles() }
    setAktion(null)
  }

  async function handleKonvertieren(demo) {
    const ok = await confirm(`Demo-Schule „${demo.schulen?.name}" in echte Schule umwandeln? Das Demo-Ablaufdatum wird entfernt.`, { confirmLabel: 'Umwandeln', dangerous: false })
    if (!ok) return
    await supabase.from('schulen').update({ ist_demo: false, demo_expires_at: null }).eq('id', demo.schulen?.id)
    toast('Schule erfolgreich umgewandelt.', 'success')
    await ladeAlles()
  }

  function verbleibendeTageBis(dt) {
    if (!dt) return null
    const diff = new Date(dt) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  function fmt(dt) {
    if (!dt) return '–'
    return new Date(dt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>🧪 Demo-Verwaltung</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14, margin: 0 }}>
          {anfragen.length} ausstehende Anfrage{anfragen.length !== 1 ? 'n' : ''} · {demos.length} aktive Demo{demos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, marginBottom: 24, width: 'fit-content', border: '1px solid var(--border)' }}>
        {[
          { key: 'anfragen', label: `Anfragen${anfragen.length ? ` (${anfragen.length})` : ''}` },
          { key: 'demos',    label: `Aktive Demos${demos.length ? ` (${demos.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
            background: tab === t.key ? 'var(--primary)' : 'transparent',
            color: tab === t.key ? 'var(--primary-fg)' : 'var(--text-2)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {laden ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 48 }}>Lade …</div>
      ) : tab === 'anfragen' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {anfragen.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 48 }}>Keine ausstehenden Anfragen.</div>
          )}
          {anfragen.map(a => (
            <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{a.schul_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 2 }}>
                    <strong>{a.name}</strong> · <a href={`mailto:${a.email}`} style={{ color: 'var(--primary)' }}>{a.email}</a>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: a.beschreibung ? 10 : 0 }}>Eingegangen: {fmt(a.erstellt_am)}</div>
                  {a.beschreibung && (
                    <div style={{ fontSize: 13, color: 'var(--text-2)', background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 8, lineHeight: 1.6, borderLeft: '3px solid var(--border)' }}>
                      {a.beschreibung}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setAblehnModal(a)}
                    disabled={aktion?.id === a.id}
                    style={{ padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >Ablehnen</button>
                  <button
                    onClick={() => handleGenehmigen(a)}
                    disabled={!!aktion}
                    style={{ padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >{aktion?.id === a.id && aktion.typ === 'genehmigen' ? 'Erstelle Demo …' : '✓ Genehmigen'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {demos.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 48 }}>Keine aktiven Demos.</div>
          )}
          {demos.map(d => {
            const tage = verbleibendeTageBis(d.schulen?.demo_expires_at)
            const kritisch = tage !== null && tage <= 2
            return (
              <div key={d.id} style={{ background: 'var(--surface)', border: `1px solid ${kritisch ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{d.schulen?.name}</span>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                        background: kritisch ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'color-mix(in srgb, var(--primary) 12%, transparent)',
                        color: kritisch ? 'var(--danger)' : 'var(--primary)',
                      }}>
                        {tage !== null ? (tage <= 0 ? 'Abgelaufen' : `${tage} Tag${tage !== 1 ? 'e' : ''} verbleibend`) : '–'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 2 }}>
                      <strong>{d.name}</strong> · <a href={`mailto:${d.email}`} style={{ color: 'var(--primary)' }}>{d.email}</a>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Genehmigt: {fmt(d.genehmigt_am)} · Läuft ab: {fmt(d.schulen?.demo_expires_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => handleVerlaengern(d.schulen)} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+7 Tage</button>
                    <button onClick={() => handleKonvertieren(d)} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Umwandeln</button>
                    <button onClick={() => handleLoeschen(d)} disabled={aktion?.id === d.id} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {aktion?.id === d.id ? '…' : '🗑 Löschen'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {ablehnModal && (
        <Modal titel="Anfrage ablehnen" onClose={() => setAblehnModal(null)}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
            Demo-Anfrage von <strong>{ablehnModal.name}</strong> für „<strong>{ablehnModal.schul_name}</strong>" ablehnen?
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAblehnModal(null)} style={btnSek}>Abbrechen</button>
            <button onClick={() => handleAblehnen(ablehnModal)} style={{ ...btnPri, background: 'var(--danger)' }}>Ablehnen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const btnPri = { padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const btnSek = { padding: '10px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
