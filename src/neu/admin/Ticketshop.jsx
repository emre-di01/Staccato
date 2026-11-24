// Verwaltung → Ticketshop: Stripe-Konto der Schule verbinden, Shop-Adresse und Pflichttexte, Shop öffnen (nur Admins)
import { useState } from 'react'
import { Copy, CreditCard, ExternalLink, Unplug } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Feld, Knopf, SchalterZeile, FehlerText, Laden, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { SLUG, shopLink, slugAus, useTicketShop } from '../ticketshop'

function Kasten({ children }) {
  return <div style={{ margin: '0 20px', padding: 20, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
}

async function kopieren(text, T, toast) {
  try { await navigator.clipboard.writeText(text); toast(T('sh_kopiert'), 'success') } catch { toast(text, 'info') }
}

export default function AdminTicketshop() {
  const { T, schule } = useApp()
  const { data, isLoading, isError } = useTicketShop()
  return (
    <Seite titel={T('sh_titel')} zurueck={{ to: '/admin/verwaltung', label: T('na_tab_verwaltung') }}>
      {isLoading ? <div style={{ marginTop: 24 }}><Laden hoehe={300} /></div>
        : isError ? <div style={{ margin: '24px 20px 0' }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div>
        : <div key={schule.id}><Stripe konto={data.konto} /><Einrichtung shop={data.shop} konto={data.konto} /></div>}
    </Seite>
  )
}

// Öffnet in Stripe direkt das Formular für einen eingeschränkten Schlüssel (Testmodus), die drei nötigen Rechte sind vorausgewählt
export const STRIPE_LINK = `https://dashboard.stripe.com/test/apikeys/create?${new URLSearchParams([
  ['name', 'Staccato Tickets'], ...['rak_checkout_session_write', 'rak_charge_write', 'rak_webhook_write'].map(r => ['permissions[]', r])])}`

const FEHLER = ['vollzugriff', 'format', 'livemodus', 'ungueltig', 'rechte']

// Der Schlüssel geht nur an die Edge Function und wird nie wieder angezeigt
function Stripe({ konto }) {
  const { T, schule, confirm, toast } = useApp()
  const neuLaden = useNeuLaden()
  const [schluessel, setSchluessel] = useState('')
  const [geheim, setGeheim] = useState('')
  const [webhook, setWebhook] = useState(null)   // { url, ereignisse }: Rückkanal muss von Hand angelegt werden
  const [aendern, setAendern] = useState(false)
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)

  async function aufruf(werte) {
    setFehler('')
    setSendet(true)
    let r
    try {
      const { data, error } = await supabase.functions.invoke('zahlungskonto', { body: { schule_id: schule.id, ...werte } })
      r = error ? await error.context?.json?.().catch(() => null) : data
    } catch { /* keine Verbindung */ }
    setSendet(false)
    return r ?? { ok: false }
  }

  async function verbinden() {
    const r = await aufruf({ aktion: 'verbinden', schluessel: schluessel.trim(), ...(webhook ? { webhook_geheim: geheim.trim() } : {}) })
    if (r.ok) {
      setSchluessel(''); setGeheim(''); setWebhook(null); setAendern(false)
      neuLaden('na-ticketshop')
      toast(T('sh_verbunden_jetzt'), 'success')
    } else if (r.grund === 'webhook_noetig') setWebhook({ url: r.url, ereignisse: r.ereignisse })
    else setFehler(r.grund === 'rechte' ? T('sh_fehler_rechte').replace('{was}', r.was === 'refunds' ? 'Charges and Refunds' : 'Checkout Sessions') : T(`sh_fehler_${FEHLER.includes(r.grund) ? r.grund : 'allgemein'}`))
  }

  async function trennen() {
    if (!await confirm(T('sh_trennen_frage'), { confirmLabel: T('sh_trennen') })) return
    const r = await aufruf({ aktion: 'trennen' })
    if (!r.ok) { setFehler(T('sh_fehler_allgemein')); return }
    neuLaden('na-ticketshop')
    toast(T('sh_getrennt'), 'success')
  }

  return (
    <Abschnitt titel={T('sh_bezahlung')} style={{ marginTop: 24 }}>
      {konto.verbunden && (
        <Gruppe>
          <Zeile icon={CreditCard} titel={T('sh_verbunden')} untertitel={`${T(konto.livemode ? 'sh_echt' : 'sh_test')} · …${konto.letzte4}`} chevron={false} />
          {!aendern && <><Trenner /><Zeile titel={T('sh_schluessel_aendern')} onClick={() => setAendern(true)} /></>}
          <Trenner />
          <Zeile icon={Unplug} iconFarbe="var(--danger)" titel={T('sh_trennen')} chevron={false} onClick={sendet ? undefined : trennen} />
        </Gruppe>
      )}
      {(!konto.verbunden || aendern) && (
        <div style={{ marginTop: konto.verbunden ? 16 : 0 }}>
          <Kasten>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text-2)' }}>{T('sh_stripe_text')}</div>
            <ol style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.6 }}>
              {[1, 2, 3].map(i => <li key={i}>{T(`sh_schritt_${i}`)}</li>)}
            </ol>
            <a href={STRIPE_LINK} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              <ExternalLink aria-hidden="true" size={20} />{T('sh_stripe_oeffnen')}
            </a>
            <Feld label={T('sh_schluessel')} hinweis={T('sh_schluessel_hinweis')}>
              <input type="password" value={schluessel} onChange={e => { setSchluessel(e.target.value); setFehler('') }} placeholder="rk_test_…" autoComplete="off" spellCheck={false} style={eingabeStil} />
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
        </div>
      )}
      {konto.verbunden && !aendern && fehler && <div style={{ margin: '12px 20px 0' }}><FehlerText>{fehler}</FehlerText></div>}
    </Abschnitt>
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
