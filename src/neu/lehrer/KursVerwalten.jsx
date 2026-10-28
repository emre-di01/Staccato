import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, CalendarRange, Printer, Download, UserPlus, FileText, Award, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useBasis } from '../rolle'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Blatt, Feld, Knopf, Suchfeld, Leer, Laden, eingabeStil } from '../../ui'
import ZertifikatModal from '../../components/ZertifikatModal'
import KursantragModal from '../../components/KursantragModal'
import { useNeuLaden } from '../daten'
import { schulZeitZuIso, tagKey, tagLabel, uhrzeit } from '../zeit'
import { kursZeit } from './kursZeit'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }

function useKursVerwalten(id) {
  return useQuery({
    queryKey: ['nl-kurs-verwalten', id],
    enabled: !!id,
    queryFn: async () => {
      const [k, tn, st] = await Promise.all([
        supabase.from('unterricht').select('*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name))').eq('id', id).single(),
        supabase.from('unterricht_schueler').select('schueler_id, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, avatar_url)').eq('unterricht_id', id).eq('status', 'aktiv'),
        supabase.from('stunden').select('id, beginn, status, notizen, hausaufgaben').eq('unterricht_id', id).order('beginn'),
      ])
      if (k.error) throw k.error
      const teilnehmer = (tn.data ?? []).filter(t => t.profiles).map(t => t.profiles)
        .sort((a, b) => a.voller_name.localeCompare(b.voller_name))
      return { kurs: k.data, teilnehmer, stunden: st.data ?? [] }
    },
  })
}

function Initialen({ p }) {
  return (
    <span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: 'var(--bg)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, overflow: 'hidden' }}>
      {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.voller_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
    </span>
  )
}

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function KursVerwalten() {
  const basis = useBasis()
  const { id } = useParams()
  const { T, lang, zeitzone, toast, confirm } = useApp()
  const { data, isLoading } = useKursVerwalten(id)
  const neuLaden = useNeuLaden()
  const [blatt, setBlatt] = useState(null)       // 'einzel' | 'zeitraum' | 'hinzufuegen' | { person }
  const [dokument, setDokument] = useState(null) // { art: 'zertifikat' | 'antrag', person }

  if (isLoading) return <Seite zurueck={{ to: `${basis}/kurse/${id}`, label: T('nl_tab_kurse') }}><div style={{ marginTop: 24 }}><Laden hoehe={300} /></div></Seite>
  if (!data) return <Seite zurueck={{ to: `${basis}/kurse`, label: T('nl_tab_kurse') }}><div style={{ marginTop: 24 }}><Leer text={T('nl_kurs_nicht_gefunden')} /></div></Seite>

  const { kurs, teilnehmer, stunden } = data
  const aktualisieren = () => neuLaden('nl-kurs-verwalten', 'nl-kurs', 'nl-stunden', 'nl-kurse')

  function notizenDrucken() {
    const mitInhalt = stunden.filter(st => st.status === 'stattgefunden' && (st.notizen || st.hausaufgaben))
    if (!mitInhalt.length) { toast(T('nl_kv_keine_notizen'), 'warning'); return }
    const datum = iso => new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: zeitzone }).format(new Date(iso))
    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">
<title>${esc(kurs.name)} – ${T('nl_kv_notizen_titel')}</title>
<style>
  body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222;padding:0 24px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#666;font-size:13px;margin:0 0 32px}
  .stunde{margin-bottom:24px;border-left:3px solid ${kurs.farbe ?? '#E8590C'};padding-left:16px}
  .datum{font-weight:700;font-size:15px;margin-bottom:8px}
  .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:3px}
  .inhalt{font-size:13px;white-space:pre-wrap;color:#444;margin:0 0 10px}
</style></head><body>
<h1>${esc(kurs.name)} – ${T('nl_kv_notizen_titel')}</h1>
<p class="sub">${new Date().toLocaleDateString(LOCALE[lang] ?? 'de-DE')} · ${mitInhalt.length}</p>
${mitInhalt.map(st => `<div class="stunde"><div class="datum">${datum(st.beginn)} · ${uhrzeit(st.beginn, zeitzone, lang)}</div>
${st.notizen ? `<div class="label">${T('nl_was_gemacht')}</div><p class="inhalt">${esc(st.notizen)}</p>` : ''}
${st.hausaufgaben ? `<div class="label">${T('nl_bis_naechstes_mal')}</div><p class="inhalt">${esc(st.hausaufgaben)}</p>` : ''}
</div>`).join('')}
</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  async function anwesenheitCsv() {
    const gehalten = stunden.filter(st => st.status === 'stattgefunden')
    if (!gehalten.length) { toast(T('nl_kv_keine_anwesenheit'), 'warning'); return }
    const { data: anw, error } = await supabase.from('anwesenheit').select('schueler_id, stunde_id, status').in('stunde_id', gehalten.map(st => st.id))
    if (error) { toast(error.message, 'error'); return }
    const map = {}
    for (const a of anw ?? []) (map[a.schueler_id] ??= {})[a.stunde_id] = a.status
    const zeichen = { anwesend: '✓', abwesend: '✗', entschuldigt: 'E', zu_spaet: 'S' }
    const zeilen = [
      [T('nl_teilnehmer'), ...gehalten.map(st => tagKey(st.beginn, zeitzone)), '%'].join(';'),
      ...teilnehmer.map(p => {
        const eigene = map[p.id] ?? {}
        const da = gehalten.filter(st => ['anwesend', 'zu_spaet'].includes(eigene[st.id])).length
        return [`"${p.voller_name.replace(/"/g, '""')}"`, ...gehalten.map(st => zeichen[eigene[st.id]] ?? '-'), Math.round(100 * da / gehalten.length)].join(';')
      }),
    ]
    const url = URL.createObjectURL(new Blob(['﻿' + zeilen.join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `anwesenheit_${kurs.name.replace(/[^a-z0-9]/gi, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function entfernen(p) {
    const ok = await confirm(T('nl_kv_entfernen_frage').replace('{name}', p.voller_name), { confirmLabel: T('nl_kv_entfernen') })
    if (!ok) return
    const { error } = await supabase.from('unterricht_schueler').delete().eq('unterricht_id', id).eq('schueler_id', p.id)
    if (error) { toast(error.message, 'error'); return }
    setBlatt(null)
    aktualisieren()
  }

  const lehrkraefte = (kurs.unterricht_lehrer ?? []).filter(l => l.profiles)

  return (
    <Seite zurueck={{ to: `${basis}/kurse/${id}`, label: kurs.name }} ueber={kurs.name} titel={T('nl_kurs_verwalten')}>
      <Abschnitt titel={T('nl_stunden')} style={{ marginTop: 24 }}>
        <Gruppe>
          <Zeile icon={CalendarPlus} titel={T('nl_kv_einzelstunde')} untertitel={T('nl_kv_einzelstunde_hinweis')} onClick={() => setBlatt('einzel')} />
          <Trenner />
          <Zeile icon={CalendarRange} titel={T('nl_kv_zeitraum')} untertitel={T('nl_kv_zeitraum_hinweis')} onClick={() => setBlatt('zeitraum')} />
          <Trenner />
          <Zeile icon={Printer} titel={T('nl_kv_notizen_drucken')} untertitel={T('nl_kv_notizen_drucken_hinweis')} onClick={notizenDrucken} chevron={false} />
          <Trenner />
          <Zeile icon={Download} titel={T('nl_kv_anwesenheit_csv')} untertitel={T('nl_kv_anwesenheit_csv_hinweis')} onClick={anwesenheitCsv} chevron={false} />
        </Gruppe>
      </Abschnitt>

      <Abschnitt titel={`${T('nl_teilnehmer')} (${teilnehmer.length})`}>
        <Gruppe>
          {teilnehmer.map(p => (
            <div key={p.id}>
              <Zeile bild={<Initialen p={p} />} titel={p.voller_name} onClick={() => setBlatt({ person: p })} />
              <Trenner />
            </div>
          ))}
          <Zeile icon={UserPlus} titel={T('nl_kv_teilnehmer_hinzufuegen')} onClick={() => setBlatt('hinzufuegen')} />
        </Gruppe>
      </Abschnitt>

      {lehrkraefte.length > 0 && (
        <Abschnitt titel={T('nl_kv_lehrkraefte')}>
          <Gruppe>
            {lehrkraefte.map((l, i) => (
              <div key={l.lehrer_id}>
                {i > 0 && <Trenner />}
                <Zeile bild={<Initialen p={l.profiles} />} titel={l.profiles.voller_name} chevron={false}
                  untertitel={l.rolle === 'hauptlehrer' ? T('nl_kv_hauptlehrer') : T('nl_kv_colehrer')} />
              </div>
            ))}
          </Gruppe>
          <div style={{ margin: '10px 20px 0', fontSize: 15, color: 'var(--text-2)' }}>{T('nl_kv_verwaltung_hinweis')}</div>
        </Abschnitt>
      )}

      {blatt === 'einzel' && <EinzelStundeBlatt kurs={kurs} onClose={() => setBlatt(null)} onFertig={() => { setBlatt(null); aktualisieren() }} />}
      {blatt === 'zeitraum' && <ZeitraumBlatt kurs={kurs} onClose={() => setBlatt(null)} onFertig={aktualisieren} />}
      {blatt === 'hinzufuegen' && <HinzufuegenBlatt kursId={id} vorhanden={teilnehmer} onClose={() => setBlatt(null)} onFertig={aktualisieren} />}
      {blatt?.person && (
        <Blatt titel={blatt.person.voller_name} onClose={() => setBlatt(null)}>
          {blatt.person.geburtsdatum && (
            <div style={{ marginBottom: 16, fontSize: 17, color: 'var(--text-2)' }}>
              {T('nl_kv_geburtstag')}: {new Date(blatt.person.geburtsdatum).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
          <Gruppe style={{ margin: 0 }}>
            <Zeile icon={FileText} titel={T('nl_kv_kursanmeldung')} onClick={() => { setDokument({ art: 'antrag', person: blatt.person }); setBlatt(null) }} />
            <Trenner />
            <Zeile icon={Award} titel={T('nl_kv_zertifikat')} onClick={() => { setDokument({ art: 'zertifikat', person: blatt.person }); setBlatt(null) }} />
            <Trenner />
            <Zeile icon={Trash2} iconFarbe="var(--danger)" titel={T('nl_kv_entfernen')} chevron={false} onClick={() => entfernen(blatt.person)} />
          </Gruppe>
        </Blatt>
      )}
      {dokument?.art === 'zertifikat' && <ZertifikatModal schueler={dokument.person} kurs={kurs} onClose={() => setDokument(null)} />}
      {dokument?.art === 'antrag' && <KursantragModal schueler={dokument.person} kurs={kurs} onClose={() => setDokument(null)} />}
    </Seite>
  )
}

function EinzelStundeBlatt({ kurs, onClose, onFertig }) {
  const { T, zeitzone, toast } = useApp()
  const [form, setForm] = useState({
    datum: tagKey(new Date().toISOString(), zeitzone),
    von: kurs.uhrzeit_von?.slice(0, 5) ?? '',
    bis: kurs.uhrzeit_bis?.slice(0, 5) ?? '',
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function anlegen() {
    if (!form.datum || !form.von || !form.bis) { toast(T('nl_kv_einzel_pflicht'), 'error'); return }
    setSendet(true)
    const { data: st, error } = await supabase.from('stunden').insert({
      unterricht_id: kurs.id, raum_id: kurs.raum_id ?? null,
      beginn: schulZeitZuIso(form.datum, form.von, zeitzone), ende: schulZeitZuIso(form.datum, form.bis, zeitzone),
    }).select('id').single()
    if (!error) {
      const lehrer = kurs.unterricht_lehrer ?? []
      if (lehrer.length) await supabase.from('stunden_lehrer').insert(lehrer.map(l => ({ stunde_id: st.id, lehrer_id: l.lehrer_id, rolle: l.rolle })))
    }
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nl_kv_stunde_angelegt'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={T('nl_kv_einzelstunde')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('nl_kv_datum')}>
          <input type="date" value={form.datum} onChange={e => setze('datum', e.target.value)} style={eingabeStil} />
        </Feld>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Feld label={T('nl_von')}><input type="time" value={form.von} onChange={e => setze('von', e.target.value)} style={eingabeStil} /></Feld></div>
          <div style={{ flex: 1 }}><Feld label={T('nl_bis')}><input type="time" value={form.bis} onChange={e => setze('bis', e.target.value)} style={eingabeStil} /></Feld></div>
        </div>
        <Knopf voll onClick={anlegen} disabled={sendet}>{T('nl_kv_stunde_anlegen')}</Knopf>
      </div>
    </Blatt>
  )
}

function ZeitraumBlatt({ kurs, onClose, onFertig }) {
  const { T, lang, zeitzone, toast, confirm } = useApp()
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')
  const [sendet, setSendet] = useState(false)
  const [ergebnis, setErgebnis] = useState(null)
  const plan = kursZeit(kurs, lang)

  async function eintragen() {
    if (!von || !bis) { toast(T('nl_kv_zeitraum_pflicht'), 'error'); return }
    setSendet(true); setErgebnis(null)
    const { data, error } = await supabase.rpc('stunden_generieren', { p_unterricht_id: kurs.id, p_von: von, p_bis: bis })
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    setErgebnis(T('nl_kv_n_eingetragen').replace('{n}', data ?? 0))
    onFertig()
  }

  async function loeschen() {
    if (!von || !bis) { toast(T('nl_kv_zeitraum_pflicht'), 'error'); return }
    const datum = d => tagLabel(schulZeitZuIso(d, '12:00', zeitzone), zeitzone, lang, T)
    const ok = await confirm(T('nl_kv_loeschen_frage').replace('{von}', datum(von)).replace('{bis}', datum(bis)), { sub: T('nl_kv_loeschen_hinweis'), confirmLabel: T('delete') })
    if (!ok) return
    setSendet(true); setErgebnis(null)
    const naechsterTag = new Date(Date.parse(bis + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase.from('stunden').delete().eq('unterricht_id', kurs.id)
      .gte('beginn', schulZeitZuIso(von, '00:00', zeitzone)).lt('beginn', schulZeitZuIso(naechsterTag, '00:00', zeitzone)).select('id')
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    setErgebnis(T('nl_kv_n_geloescht').replace('{n}', data?.length ?? 0))
    onFertig()
  }

  return (
    <Blatt titel={T('nl_kv_zeitraum')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--n-fill)', fontSize: 17, color: plan ? 'var(--text)' : 'var(--danger)' }}>
          {plan ? T('nl_kv_wochenplan').replace('{zeit}', plan) : T('nl_kv_kein_wochenplan')}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Feld label={T('nl_von')}><input type="date" value={von} onChange={e => setVon(e.target.value)} style={eingabeStil} /></Feld></div>
          <div style={{ flex: 1 }}><Feld label={T('nl_bis')}><input type="date" value={bis} onChange={e => setBis(e.target.value)} style={eingabeStil} /></Feld></div>
        </div>
        {ergebnis && <div role="status" style={{ fontSize: 17, fontWeight: 600, color: 'var(--success)' }}>{ergebnis}</div>}
        <Knopf voll onClick={eintragen} disabled={sendet || !plan}>{T('nl_kv_eintragen')}</Knopf>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={loeschen} disabled={sendet}>{T('nl_kv_zeitraum_loeschen')}</Knopf>
      </div>
    </Blatt>
  )
}

function HinzufuegenBlatt({ kursId, vorhanden, onClose, onFertig }) {
  const { T, toast } = useApp()
  const [suche, setSuche] = useState('')
  const [hinzu, setHinzu] = useState([])
  const { data: alle = [], isLoading } = useQuery({
    queryKey: ['nl-schueler-auswahl'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, voller_name, avatar_url')
        .in('rolle', ['schueler', 'vorstand', 'admin', 'superadmin']).eq('aktiv', true).order('voller_name')
      return data ?? []
    },
  })
  const drin = new Set([...vorhanden.map(p => p.id), ...hinzu])
  const q = suche.trim().toLowerCase()
  const treffer = alle.filter(p => !drin.has(p.id) && (!q || p.voller_name.toLowerCase().includes(q))).slice(0, 30)

  async function hinzufuegen(p) {
    const { error } = await supabase.from('unterricht_schueler').upsert({ unterricht_id: kursId, schueler_id: p.id, status: 'aktiv' })
    if (error) { toast(error.message, 'error'); return }
    setHinzu(h => [...h, p.id])
    toast(T('nl_kv_hinzugefuegt').replace('{name}', p.voller_name), 'success')
    onFertig()
  }

  return (
    <Blatt titel={T('nl_kv_teilnehmer_hinzufuegen')} onClose={onClose}>
      <div style={{ margin: '0 -20px 16px' }}>
        <Suchfeld wert={suche} onChange={setSuche} placeholder={T('nl_kv_name_suchen')} label={T('nl_kv_name_suchen')} />
      </div>
      {isLoading ? <Laden hoehe={160} /> : treffer.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 17, color: 'var(--text-2)' }}>{T('nl_kv_keine_treffer')}</div>
      ) : (
        <Gruppe style={{ margin: 0 }}>
          {treffer.map((p, i) => (
            <div key={p.id}>
              {i > 0 && <Trenner />}
              <Zeile bild={<Initialen p={p} />} titel={p.voller_name} chevron={false}
                wert={T('nl_kv_hinzu')} wertFarbe="var(--primary)" onClick={() => hinzufuegen(p)} />
            </div>
          ))}
        </Gruppe>
      )}
    </Blatt>
  )
}
