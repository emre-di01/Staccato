// Verwaltung → Ticketshop: Stripe- oder SumUp-Konto der Schule verbinden, Shop-Adresse und Pflichttexte, Shop öffnen (nur Admins)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, CreditCard, ExternalLink, LogIn, Store, Unplug } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Abschnitt, Gruppe, Trenner, Zeile, Feld, Knopf, SchalterZeile, FehlerText, Laden, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { ANBIETER, SHOP_LIVE, SLUG, shopLink, slugAus, useTicketShop } from '../ticketshop'

function Kasten({ children }) {
  return <div style={{ margin: '0 20px', padding: 20, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
}

async function kopieren(text, T, toast) {
  try { await navigator.clipboard.writeText(text); toast(T('sh_kopiert'), 'success') } catch { toast(text, 'info') }
}

export default function AdminTicketshop() {
  const { T, schule } = useApp()
  const { data, isLoading, isLoadingError: isError } = useTicketShop()
  return (
    <Seite titel={T('sh_titel')} zurueck={{ to: '/admin/verwaltung', label: T('na_tab_verwaltung') }}>
      {isLoading ? <div style={{ marginTop: 24 }}><Laden hoehe={300} /></div>
        : isError ? <div style={{ margin: '24px 20px 0' }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div>
        : <div key={schule.id}><Bezahlung konto={data.konto} /><Einrichtung shop={data.shop} konto={data.konto} /></div>}
    </Seite>
  )
}

// Öffnet in Stripe direkt das Formular für einen eingeschränkten Schlüssel, die drei nötigen Rechte sind vorausgewählt
export const stripeLink = live => `https://dashboard.stripe.com/${live ? '' : 'test/'}apikeys/create?${new URLSearchParams([
  ['name', 'Staccato Tickets'], ...['rak_checkout_session_write', 'rak_charge_write', 'rak_webhook_write'].map(r => ['permissions[]', r])])}`

const FEHLER = ['vollzugriff', 'format', 'livemodus', 'ungueltig', 'rechte']

// Aufruf der Edge Function „zahlungskonto“; bei Netzfehlern { ok: false }
export async function kontoAufruf(werte) {
  try {
    const { data, error } = await supabase.functions.invoke('zahlungskonto', { body: werte })
    return (error ? await error.context?.json?.().catch(() => null) : data) ?? { ok: false }
  } catch { return { ok: false } }
}

const mitAnbieter = (text, a) => text.replaceAll('{anbieter}', ANBIETER[a])

// Stripe oder SumUp. Beide können verbunden sein, über einen rechnet der Shop ab.
function Bezahlung({ konto }) {
  const { T, schule, confirm, toast } = useApp()
  const neuLaden = useNeuLaden()
  const [anbieter, setAnbieter] = useState(konto.anbieter ?? konto.konten[0]?.anbieter ?? 'stripe')
  const [aendern, setAendern] = useState(false)
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const k = konto.konten.find(x => x.anbieter === anbieter)
  const fertig = meldung => { setAendern(false); setFehler(''); neuLaden('na-ticketshop'); toast(mitAnbieter(T(meldung), anbieter), 'success') }

  async function trennen() {
    if (!await confirm(mitAnbieter(T('sh_trennen_frage'), anbieter), { confirmLabel: mitAnbieter(T('sh_trennen'), anbieter) })) return
    setFehler('')
    setSendet(true)
    const r = await kontoAufruf({ schule_id: schule.id, aktion: 'trennen', anbieter })
    setSendet(false)
    if (!r.ok) { setFehler(T('sh_fehler_allgemein')); return }
    fertig('sh_getrennt')
  }

  async function verwenden() {
    const { data, error } = await supabase.rpc('zahlungskonto_waehlen', { p_schule_id: schule.id, p_anbieter: anbieter })
    if (error || !data) { setFehler(error?.message ?? T('sh_fehler_allgemein')); return }
    fertig('sh_wird_verwendet')
  }

  async function demoLoeschen() {
    if (!await confirm(T('sh_demo_loeschen_frage'), { confirmLabel: T('sh_demo_loeschen') })) return
    const { data, error } = await supabase.rpc('shop_demo_loeschen', { p_schule_id: schule.id })
    if (error) { toast(error.message, 'error'); return }
    neuLaden('na-ticketshop', 'na-ticket-bestellungen')
    toast(T('sh_demo_geloescht').replace('{n}', data), 'success')
  }

  return (
    <Abschnitt titel={T('sh_bezahlung')} style={{ marginTop: 24 }}>
      <Segment label={T('sh_anbieter')} wert={anbieter} onChange={a => { setAnbieter(a); setAendern(false); setFehler('') }} style={{ margin: '0 20px 16px' }}
        optionen={Object.entries(ANBIETER)} />
      {k && (
        <Gruppe>
          <Zeile icon={CreditCard} titel={mitAnbieter(T('sh_verbunden'), anbieter)} chevron={false}
            untertitel={`${T(k.livemode ? 'sh_echt' : anbieter === 'sumup' ? 'sh_test_sumup' : 'sh_test')} · …${k.letzte4}`} />
          <Trenner />
          {k.aktiv ? <Zeile icon={Check} titel={T('sh_im_shop')} chevron={false} />
            : <Zeile icon={Store} titel={T('sh_im_shop_verwenden')} untertitel={T('sh_im_shop_hinweis')} onClick={verwenden} />}
          {!aendern && <><Trenner /><Zeile titel={T(anbieter === 'sumup' ? 'sh_neu_verbinden' : 'sh_schluessel_aendern')} onClick={() => setAendern(true)} /></>}
          <Trenner />
          <Zeile icon={Unplug} iconFarbe="var(--danger)" titel={mitAnbieter(T('sh_trennen'), anbieter)} chevron={false} onClick={sendet ? undefined : trennen} />
        </Gruppe>
      )}
      {k?.neu_verbinden && <div style={{ margin: '12px 20px 0' }}><FehlerText>{T('sh_sumup_abgelaufen')}</FehlerText></div>}
      {konto.verbunden && !konto.livemode && (
        <div style={{ margin: '12px 20px 0', padding: 16, borderRadius: 18, background: '#FDE68A', color: '#422006', fontSize: 16, lineHeight: 1.45 }}>
          {T('sh_demo_hinweis')}
          <div style={{ marginTop: 12 }}><Knopf klein onClick={demoLoeschen} disabled={sendet} style={{ background: '#422006', color: '#FFFFFF' }}>{T('sh_demo_loeschen')}</Knopf></div>
        </div>
      )}
      {konto.verbunden && konto.livemode && konto.demos > 0 && (
        <div style={{ margin: '12px 20px 0' }}><Knopf klein variante="sekundaer" onClick={demoLoeschen} disabled={sendet}>{T('sh_demo_loeschen')}</Knopf></div>
      )}
      {(!k || aendern || k.neu_verbinden) && (
        <div style={{ marginTop: k ? 16 : 0 }}>
          {anbieter === 'stripe' ? <Stripe onFertig={() => fertig('sh_verbunden_jetzt')} /> : <SumUp onFertig={() => fertig('sh_verbunden_jetzt')} />}
        </div>
      )}
      {fehler && <div style={{ margin: '12px 20px 0' }}><FehlerText>{fehler}</FehlerText></div>}
    </Abschnitt>
  )
}

// Der Schlüssel geht nur an die Edge Function und wird nie wieder angezeigt
function Stripe({ onFertig }) {
  const { T, schule, toast } = useApp()
  const [schluessel, setSchluessel] = useState('')
  const [geheim, setGeheim] = useState('')
  const [webhook, setWebhook] = useState(null)   // { url, ereignisse }: Rückkanal muss von Hand angelegt werden
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)

  async function verbinden() {
    // Schlüssel von SumUp im Stripe-Reiter: nicht erst abschicken
    if (/^sup_/.test(schluessel.trim())) { setFehler(T('sh_fehler_ist_sumup')); return }
    setFehler('')
    setSendet(true)
    const r = await kontoAufruf({ schule_id: schule.id, aktion: 'verbinden', schluessel: schluessel.trim(), ...(webhook ? { webhook_geheim: geheim.trim() } : {}) })
    setSendet(false)
    if (r.ok) { setSchluessel(''); setGeheim(''); setWebhook(null); onFertig() }
    else if (r.grund === 'webhook_noetig') setWebhook({ url: r.url, ereignisse: r.ereignisse })
    else setFehler(r.grund === 'rechte' ? T('sh_fehler_rechte').replace('{was}', r.was === 'refunds' ? 'Charges and Refunds' : 'Checkout Sessions') : mitAnbieter(T(`sh_fehler_${FEHLER.includes(r.grund) ? r.grund : 'allgemein'}`), 'stripe'))
  }

  return (
    <Kasten>
      <div style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text-2)' }}>{T('sh_stripe_text')}</div>
      <ol style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.6 }}>
        {[1, 2, 3].map(i => <li key={i}>{T(`sh_schritt_${i}`)}</li>)}
      </ol>
      <div>
        {(SHOP_LIVE ? [true, false] : [false]).map(live => (
          <a key={String(live)} href={stripeLink(live)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
            <ExternalLink aria-hidden="true" size={20} style={{ flexShrink: 0 }} />{T(live ? 'sh_stripe_oeffnen_echt' : 'sh_stripe_oeffnen')}
          </a>
        ))}
      </div>
      {SHOP_LIVE && <div style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('sh_demo_moeglich')}</div>}
      <Feld label={T('sh_schluessel')} hinweis={T('sh_schluessel_hinweis')}>
        <input type="password" value={schluessel} onChange={e => { setSchluessel(e.target.value); setFehler('') }} placeholder={SHOP_LIVE ? 'rk_…' : 'rk_test_…'} autoComplete="off" spellCheck={false} style={eingabeStil} />
      </Feld>
      {webhook && <>
        <div role="status" style={{ fontSize: 16, lineHeight: 1.5 }}>{T('sh_webhook_text')}</div>
        <div style={{ padding: 14, borderRadius: 14, background: 'var(--bg)', fontSize: 15, overflowWrap: 'anywhere' }}>
          <div>{webhook.url}</div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{webhook.ereignisse.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
        <Knopf klein variante="tint" icon={Copy} onClick={() => kopieren(webhook.url, T, toast)}>{T('sh_adresse_kopieren')}</Knopf>
        <Feld label={T('sh_webhook_geheim')}>
          <input type="password" value={geheim} onChange={e => { setGeheim(e.target.value); setFehler('') }} placeholder="whsec_…" autoComplete="off" spellCheck={false} style={eingabeStil} />
        </Feld>
      </>}
      {fehler && <FehlerText>{fehler}</FehlerText>}
      <Knopf voll onClick={verbinden} disabled={sendet || !schluessel.trim() || (webhook && !geheim.trim())}>{T(sendet ? 'sh_prueft' : 'sh_verbinden')}</Knopf>
    </Kasten>
  )
}

const SUMUP_FEHLER = ['livemodus', 'oeffentlich', 'waehrung', 'rechte', 'abgelaufen', 'ungueltig', 'nicht_eingerichtet']
export const sumupFehler = (T, { grund, konto }) => T(SUMUP_FEHLER.includes(grund) ? `sh_sumup_fehler_${grund}` : `sh_fehler_${grund === 'format' ? 'format' : 'allgemein'}`).replace('{konto}', () => konto ?? 'SumUp')

// Mehrere Händlerkonten hinter einem Zugang: eines auswählen
export function HaendlerWahl({ liste, sendet, onWahl }) {
  const { T } = useApp()
  if (!liste.length) return <FehlerText>{T('sh_sumup_kein_konto')}</FehlerText>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{T('sh_sumup_welches')}</div>
      {liste.map(h => <Knopf key={h.code} voll variante="rahmen" disabled={sendet} onClick={() => onWahl(h.code)}>{`${h.name}${h.sandbox ? ` (${T('sh_demo')})` : ''}`}</Knopf>)}
    </div>
  )
}

// SumUp: anmelden (OAuth, falls auf dem Server eingerichtet) oder API-Schlüssel eintragen
function SumUp({ onFertig }) {
  const { T, schule } = useApp()
  const [schluessel, setSchluessel] = useState('')
  const [liste, setListe] = useState(null)
  const [perSchluessel, setPerSchluessel] = useState(false)
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const { data: oauth, isLoading } = useQuery({
    queryKey: ['na-sumup-oauth', schule.id],
    queryFn: async () => (await kontoAufruf({ schule_id: schule.id, aktion: 'sumup_moeglich' })).oauth === true,
  })

  async function anmelden() {
    setFehler('')
    setSendet(true)
    const r = await kontoAufruf({ schule_id: schule.id, aktion: 'sumup_start' })
    if (r.ok) { window.location.assign(r.url); return }
    setSendet(false)
    setFehler(sumupFehler(T, r))
  }

  async function verbinden(haendler) {
    // Schlüssel von Stripe im SumUp-Reiter
    if (/^(rk|sk|pk)_/.test(schluessel.trim())) { setFehler(T('sh_fehler_ist_stripe')); return }
    setFehler('')
    setSendet(true)
    const r = await kontoAufruf({ schule_id: schule.id, aktion: 'sumup_schluessel', schluessel: schluessel.trim(), ...(haendler ? { haendler } : {}) })
    setSendet(false)
    if (r.ok) { setSchluessel(''); setListe(null); onFertig() }
    else if (r.grund === 'haendler') setListe(r.liste)
    else { setListe(null); setFehler(sumupFehler(T, r)) }
  }

  if (isLoading) return <Laden hoehe={160} />
  return (
    <Kasten>
      <div style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text-2)' }}>{T('sh_sumup_text')}</div>
      {oauth && <Knopf voll icon={LogIn} onClick={anmelden} disabled={sendet}>{T('sh_sumup_anmelden')}</Knopf>}
      {oauth && !perSchluessel && <Knopf voll variante="rahmen" onClick={() => setPerSchluessel(true)}>{T('sh_sumup_per_schluessel')}</Knopf>}
      {(!oauth || perSchluessel) && <>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.6 }}>
          {[1, 2, 3].map(i => <li key={i}>{T(`sh_sumup_schritt_${i}`)}</li>)}
        </ol>
        <a href="https://me.sumup.com/settings/api-keys" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
          <ExternalLink aria-hidden="true" size={20} style={{ flexShrink: 0 }} />{T('sh_sumup_oeffnen')}
        </a>
        <div style={{ padding: 14, borderRadius: 14, background: '#FDE68A', color: '#422006', fontSize: 15, lineHeight: 1.45 }}>{T('sh_sumup_warnung')}</div>
        <Feld label={T('sh_sumup_schluessel')} hinweis={T('sh_sumup_schluessel_hinweis')}>
          <input type="password" value={schluessel} onChange={e => { setSchluessel(e.target.value); setFehler(''); setListe(null) }} placeholder="sup_sk_…" autoComplete="off" spellCheck={false} style={eingabeStil} />
        </Feld>
        {liste && <HaendlerWahl liste={liste} sendet={sendet} onWahl={verbinden} />}
        {!liste && <Knopf voll variante={oauth ? 'sekundaer' : 'primaer'} onClick={() => verbinden()} disabled={sendet || !schluessel.trim()}>{T(sendet ? 'sh_prueft' : 'sh_verbinden')}</Knopf>}
      </>}
      {fehler && <FehlerText>{fehler}</FehlerText>}
    </Kasten>
  )
}

const TEXTE = ['impressum', 'agb', 'datenschutz']

function Einrichtung({ shop, konto }) {
  const { T, schule, toast } = useApp()
  const neuLaden = useNeuLaden()
  const [form, setForm] = useState({ slug: shop?.slug ?? slugAus(schule.name), aktiv: shop?.aktiv ?? false, ...Object.fromEntries(TEXTE.map(k => [k, shop?.[k] ?? ''])) })
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => { setFehler(''); setForm(f => ({ ...f, [k]: v })) }
  const link = shopLink(shop?.slug)

  async function speichern() {
    const slug = form.slug.trim().toLowerCase()
    if (!SLUG.test(slug) || slug === 'bestellung') { setFehler(T('sh_fehler_adresse')); return }
    if (form.aktiv && TEXTE.some(k => !form[k].trim())) { setFehler(T('sh_fehler_texte')); return }
    if (form.aktiv && !konto.verbunden) { setFehler(T('sh_fehler_konto')); return }
    setSendet(true)
    const { error } = await supabase.from('ticket_shops').upsert({ schule_id: schule.id, slug, aktiv: form.aktiv, ...Object.fromEntries(TEXTE.map(k => [k, form[k].trim()])), aktualisiert_am: new Date().toISOString() })
    setSendet(false)
    if (error) { setFehler(error.code === '23505' ? T('sh_fehler_adresse_belegt') : error.message); return }
    neuLaden('na-ticketshop')
    toast(T('sh_gespeichert'), 'success')
  }

  return <>
    <Abschnitt titel={T('sh_shop')}>
      <Kasten>
        <Feld label={T('sh_adresse')} hinweis={`${window.location.origin}/shop/${form.slug || '…'}`}>
          <input value={form.slug} maxLength={40} autoCapitalize="none" spellCheck={false} onChange={e => setze('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} style={eingabeStil} />
        </Feld>
        {shop?.aktiv && <Knopf klein variante="tint" icon={Copy} onClick={() => kopieren(link, T, toast)}>{T('sh_link_kopieren')}</Knopf>}
        {TEXTE.map(k => (
          <Feld key={k} label={T(`shop_${k}`)} hinweis={k === 'agb' ? T('sh_texte_hinweis') : undefined}>
            <textarea rows={6} value={form[k]} onChange={e => setze(k, e.target.value)} style={{ ...eingabeStil, resize: 'vertical', lineHeight: 1.5 }} />
          </Feld>
        ))}
      </Kasten>
      <Gruppe style={{ marginTop: 16 }}>
        <SchalterZeile titel={T('sh_offen')} untertitel={T('sh_offen_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
      </Gruppe>
      <div style={{ margin: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={speichern} disabled={sendet}>{T('save')}</Knopf>
        {shop?.aktiv && <a href={link} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'center', padding: '12px 0', fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>{T('sh_ansehen')}</a>}
      </div>
    </Abschnitt>
  </>
}
