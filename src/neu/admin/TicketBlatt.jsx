import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, SchalterZeile, Gruppe, FehlerText, eingabeStil } from '../../ui'
import { inputWert } from '../zeit'
import { einstellungenAusFormular } from '../tickets'

const betragText = wert => wert == null ? '' : Number(wert).toFixed(2).replace('.', ',')

// Ticketeinstellungen einer Veranstaltung (nur Admins)
export default function TicketBlatt({ ev, einstellungen: e, onClose, onFertig }) {
  const { T, toast } = useApp()
  const [form, setForm] = useState({
    aktiv: e?.aktiv ?? false, kapazitaet: String(e?.kapazitaet ?? ''), preis_normal: betragText(e?.preis_normal),
    ermaessigt: (e?.kontingent ?? 0) > 0, preis_verguenstigt: betragText(e?.preis_verguenstigt),
    kontingent: String(e?.kontingent || 3), obergrenze: String(e?.obergrenze ?? 10),
    preis_abendkasse: betragText(e?.preis_abendkasse),
    verkauf_von: inputWert(e?.verkauf_von), verkauf_bis: inputWert(e?.verkauf_bis), frist_tage: String(e?.frist_tage ?? 7),
    bis_abendkasse: e?.bis_abendkasse ?? false, freigabe_minuten: String(e?.freigabe_minuten ?? 30),
  })
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => { setFehler(''); setForm(f => ({ ...f, [k]: v })) }
  const eingabe = (k, inputMode) => ({ value: form[k], inputMode, onChange: x => setze(k, x.target.value), style: eingabeStil })

  async function speichern() {
    const { fehler: ungueltig, werte } = einstellungenAusFormular(form)
    if (ungueltig) { setFehler(T(ungueltig)); return }
    setSendet(true)
    const { error } = e
      ? await supabase.from('ticket_einstellungen').update(werte).eq('event_id', ev.id)
      : await supabase.from('ticket_einstellungen').insert({ ...werte, event_id: ev.id })
    setSendet(false)
    if (error) {
      const belegt = error.message.match(/ticket_kapazitaet_belegt:(\d+)/)?.[1]
      setFehler(belegt ? T('tk_fehler_belegt').replace('{n}', belegt) : error.message)
      return
    }
    toast(T('tk_gespeichert'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={T('tk_einstellungen')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Gruppe style={{ margin: 0 }}>
          <SchalterZeile titel={T('tk_verkauf')} untertitel={T('tk_verkauf_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
        </Gruppe>
        {form.aktiv && !ev.oeffentlich && <div role="status" style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('tk_nicht_oeffentlich')}</div>}
        <Feld label={T('tk_kapazitaet')} hinweis={T('tk_kapazitaet_hinweis')}><input {...eingabe('kapazitaet', 'numeric')} /></Feld>
        <Feld label={T('tk_preis_normal')}><input {...eingabe('preis_normal', 'decimal')} placeholder="15,00" /></Feld>
        <Feld label={T('tk_preis_abendkasse')} hinweis={T('tk_preis_abendkasse_hinweis')}><input {...eingabe('preis_abendkasse', 'decimal')} placeholder={form.preis_normal || '18,00'} /></Feld>
        <Feld label={T('tk_obergrenze')}><input {...eingabe('obergrenze', 'numeric')} /></Feld>

        <Gruppe style={{ margin: 0 }}>
          <SchalterZeile titel={T('tk_ermaessigt')} untertitel={T('tk_ermaessigt_hinweis')} an={form.ermaessigt} onChange={v => setze('ermaessigt', v)} />
        </Gruppe>
        {form.ermaessigt && <>
          <Feld label={T('tk_preis_verguenstigt')}><input {...eingabe('preis_verguenstigt', 'decimal')} placeholder="8,00" /></Feld>
          <Feld label={T('tk_kontingent')} hinweis={T('tk_kontingent_hinweis')}><input {...eingabe('kontingent', 'numeric')} /></Feld>
        </>}

        <Feld label={T('tk_verkauf_von')} hinweis={T('tk_verkauf_von_hinweis')}><input type="datetime-local" {...eingabe('verkauf_von')} /></Feld>
        <Feld label={T('tk_verkauf_bis')} hinweis={T('tk_verkauf_bis_hinweis')}><input type="datetime-local" {...eingabe('verkauf_bis')} /></Feld>

        <Gruppe style={{ margin: 0 }}>
          <SchalterZeile titel={T('tk_bis_abendkasse')} untertitel={T('tk_bis_abendkasse_hinweis')} an={form.bis_abendkasse} onChange={v => setze('bis_abendkasse', v)} />
        </Gruppe>
        {form.bis_abendkasse
          ? <Feld label={T('tk_freigabe_minuten')} hinweis={T('tk_freigabe_minuten_hinweis')}><input {...eingabe('freigabe_minuten', 'numeric')} /></Feld>
          : <Feld label={T('tk_frist_tage')} hinweis={T('tk_frist_tage_hinweis')}><input {...eingabe('frist_tage', 'numeric')} /></Feld>}

        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={speichern} disabled={sendet}>{T('save')}</Knopf>
      </div>
    </Blatt>
  )
}
