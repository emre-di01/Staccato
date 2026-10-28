import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Gruppe, Trenner, Zeile, LiedCover, Leer, Laden, Blatt, Suchfeld, Knopf, Feld, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { useBasis } from '../rolle'

const STATUS = ['aktuell', 'geplant', 'abgeschlossen']

// Lieder eines Kurses (art='kurs') oder einer Veranstaltung (art='event').
// Lehrer verwalten (hinzufügen, Status bzw. Reihenfolge, entfernen), Schüler sehen nur.
export default function LiederListe({ art }) {
  const { id } = useParams()
  const { profil, rolle, T, toast, confirm } = useApp()
  const basis = useBasis()
  const neuLaden = useNeuLaden()
  const [hinzufuegen, setHinzufuegen] = useState(false)
  const [auswahl, setAuswahl] = useState(null)   // Eintrag, dessen Optionen offen sind
  const tabelle = art === 'kurs' ? 'unterricht_stuecke' : 'event_stuecke'
  const fk = art === 'kurs' ? 'unterricht_id' : 'event_id'

  const { data, isLoading } = useQuery({
    queryKey: ['n-liederliste', art, id],
    queryFn: async () => {
      const [kopf, eintraege] = await Promise.all([
        art === 'kurs'
          ? supabase.from('unterricht').select('id, name').eq('id', id).single()
          : supabase.from('events').select('id, titel, erstellt_von').eq('id', id).single(),
        supabase.from(tabelle).select(`*, stuecke(id, titel, komponist)`).eq(fk, id).order('reihenfolge'),
      ])
      if (kopf.error) throw kopf.error
      const liste = (eintraege.data ?? []).filter(e => e.stuecke)
      if (art === 'kurs') liste.sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || a.stuecke.titel.localeCompare(b.stuecke.titel))
      return { name: kopf.data.name ?? kopf.data.titel, erstelltVon: kopf.data.erstellt_von, liste }
    },
  })

  const zurueck = art === 'kurs'
    ? { to: `/lehrer/kurse/${id}`, label: data?.name ?? T('nl_tab_kurse') }
    : { to: rolle === 'lehrer' ? '/lehrer/anwesenheit' : '/schueler/stundenplan', label: T('n_tab_termine') }
  const darfBearbeiten = rolle === 'lehrer' && (art === 'kurs' || data?.erstelltVon === profil?.id)
  const liedPfad = sid => art === 'kurs' ? `/lehrer/kurse/${id}/repertoire/${sid}` : `${basis}/events/${id}/repertoire/${sid}`
  const liste = data?.liste ?? []
  const navState = { liste: liste.map(e => ({ id: e.stuecke.id, titel: e.stuecke.titel })) }
  const neu = () => neuLaden('n-liederliste', 'nl-kurs', 'nl-lieder', 'n-events')

  async function status(e, s) {
    setAuswahl(null)
    const { error } = await supabase.from(tabelle).update({ status: s }).eq(fk, id).eq('stueck_id', e.stueck_id)
    if (error) { toast(error.message, 'error'); return }
    neu()
  }

  async function entfernen(e) {
    setAuswahl(null)
    if (!await confirm(T('nl_lied_entfernen_frage').replace('{titel}', e.stuecke.titel), { sub: T('nl_lied_entfernen_hinweis'), confirmLabel: T('remove') })) return
    const { error } = await supabase.from(tabelle).delete().eq(fk, id).eq('stueck_id', e.stueck_id)
    if (error) { toast(error.message, 'error'); return }
    neu()
  }

  async function verschieben(i, richtung) {
    const neueListe = [...liste]
    const [e] = neueListe.splice(i, 1)
    neueListe.splice(i + richtung, 0, e)
    await Promise.all(neueListe.map((x, n) => supabase.from(tabelle).update({ reihenfolge: n }).eq(fk, id).eq('stueck_id', x.stueck_id)))
    neu()
  }

  const statusText = s => ({ aktuell: T('nl_aktuell'), geplant: T('nl_geplant'), abgeschlossen: T('nl_abgeschlossen') }[s] ?? null)

  return (
    <Seite zurueck={zurueck} ueber={data?.name} titel={T('n_tab_lieder')} rechts={darfBearbeiten && (
      <Knopf klein variante="tint" icon={Plus} onClick={() => setHinzufuegen(true)}>{T('nl_hinzufuegen')}</Knopf>
    )}>
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden hoehe={240} /> : liste.length === 0 ? <Leer text={T('n_noch_keine_lieder')} /> : (
          <Gruppe>
            {liste.map((e, i) => (
              <div key={e.stueck_id}>
                {i > 0 && <Trenner />}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Zeile bild={<LiedCover id={e.stuecke.id} groesse={44} radius={10} />} titel={e.stuecke.titel}
                      untertitel={[e.stuecke.komponist, e.interpret].filter(Boolean).join(' · ')}
                      wert={art === 'kurs' ? statusText(e.status) : null} wertFarbe={e.status === 'aktuell' ? 'var(--primary)' : 'var(--text-2)'}
                      chevron={!darfBearbeiten} to={liedPfad(e.stuecke.id)} state={navState} />
                  </div>
                  {darfBearbeiten && art === 'event' && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button onClick={() => verschieben(i, -1)} disabled={i === 0} aria-label={T('nl_nach_oben')} style={pfeil(i === 0)}><ChevronUp size={20} /></button>
                      <button onClick={() => verschieben(i, 1)} disabled={i === liste.length - 1} aria-label={T('nl_nach_unten')} style={pfeil(i === liste.length - 1)}><ChevronDown size={20} /></button>
                    </div>
                  )}
                  {darfBearbeiten && (
                    <button onClick={() => setAuswahl(e)} aria-label={`${T('nl_optionen')}: ${e.stuecke.titel}`} style={{ width: 48, height: 48, marginRight: 6, border: 'none', borderRadius: 24, background: 'transparent', color: 'var(--text-2)', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>⋯</button>
                  )}
                </div>
              </div>
            ))}
          </Gruppe>
        )}
      </div>

      {auswahl && (
        <Blatt titel={auswahl.stuecke.titel} onClose={() => setAuswahl(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {art === 'kurs' && STATUS.map(s => (
              <Knopf key={s} voll variante={auswahl.status === s ? 'primaer' : 'sekundaer'} onClick={() => status(auswahl, s)}>{statusText(s)}</Knopf>
            ))}
            <Knopf voll variante="gefahr" icon={Trash2} onClick={() => entfernen(auswahl)}>{art === 'kurs' ? T('nl_aus_kurs_entfernen') : T('nl_aus_event_entfernen')}</Knopf>
          </div>
        </Blatt>
      )}

      {hinzufuegen && (
        <HinzufuegenBlatt art={art} zielId={id} vorhanden={new Set(liste.map(e => e.stueck_id))} anzahl={liste.length}
          onClose={() => setHinzufuegen(false)} onFertig={() => { setHinzufuegen(false); neu() }} />
      )}
    </Seite>
  )
}

const pfeil = aus => ({ width: 40, height: 30, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: aus ? 'default' : 'pointer', opacity: aus ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' })

// Lied aus der Bibliothek zuordnen (Kurs: benachrichtigt die Teilnehmer wie bisher)
function HinzufuegenBlatt({ art, zielId, vorhanden, anzahl, onClose, onFertig }) {
  const { T, toast } = useApp()
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState(null)
  const [interpret, setInterpret] = useState('')
  const [sendet, setSendet] = useState(false)
  const { data: alle = [], isLoading } = useQuery({
    queryKey: ['n-bibliothek'],
    queryFn: async () => (await supabase.from('stuecke').select('id, titel, komponist').order('titel')).data ?? [],
  })
  const q = suche.trim().toLowerCase()
  const treffer = alle.filter(st => !vorhanden.has(st.id) && (!q || st.titel.toLowerCase().includes(q) || (st.komponist ?? '').toLowerCase().includes(q))).slice(0, 50)

  async function zuordnen(st) {
    setSendet(true)
    const { error } = art === 'kurs'
      ? await supabase.from('unterricht_stuecke').insert({ unterricht_id: zielId, stueck_id: st.id, status: 'aktuell' })
      : await supabase.from('event_stuecke').insert({ event_id: zielId, stueck_id: st.id, interpret: interpret.trim() || null, reihenfolge: anzahl })
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    if (art === 'kurs') {
      const body = { type: 'new_piece', unterricht_id: zielId, stueck_id: st.id }
      supabase.functions.invoke('send-email', { body }).catch(() => {})
      supabase.functions.invoke('send-push', { body }).catch(() => {})
    }
    onFertig()
  }

  return (
    <Blatt titel={T('nl_lied_hinzufuegen')} onClose={onClose}>
      {gewaehlt ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{gewaehlt.titel}</div>
          <Feld label={T('nl_interpret')} hinweis={T('nl_interpret_hinweis')}>
            <input value={interpret} onChange={e => setInterpret(e.target.value)} style={eingabeStil} />
          </Feld>
          <Knopf voll onClick={() => zuordnen(gewaehlt)} disabled={sendet}>{T('nl_hinzufuegen')}</Knopf>
        </div>
      ) : (
        <>
          <div style={{ margin: '0 -20px' }}>
            <Suchfeld wert={suche} onChange={setSuche} label={T('n_lieder_suchen')} placeholder={T('n_titel_oder_komponist')} />
          </div>
          <div style={{ marginTop: 12, margin: '12px -20px 0' }}>
            {isLoading ? <Laden /> : treffer.length === 0 ? <Leer text={T('n_kein_lied_gefunden')} /> : (
              <Gruppe>
                {treffer.map((st, i) => (
                  <div key={st.id}>
                    {i > 0 && <Trenner />}
                    <Zeile bild={<LiedCover id={st.id} groesse={40} radius={10} />} titel={st.titel} untertitel={st.komponist}
                      onClick={sendet ? undefined : () => (art === 'event' ? setGewaehlt(st) : zuordnen(st))} chevron={false} />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>
        </>
      )}
    </Blatt>
  )
}
