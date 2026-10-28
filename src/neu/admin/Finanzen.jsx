import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Printer, CircleCheck, Ban, TriangleAlert, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Suchfeld, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, Feld, Segment, FehlerText, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { calcTotals, empfName, druckeRechnung } from '../../pages/admin/Rechnungen'
import { useBreit, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const WEGE = ['ueberweisung', 'sepa', 'bar', 'sonstiges']
const STATUS_FARBE = { offen: '#1D4ED8', ueberfaellig: '#C2410C', bezahlt: 'var(--success)', storniert: 'var(--danger)' }

function status(r) {
  if (r.storniert_am) return 'storniert'
  if (r.bezahlt_am) return 'bezahlt'
  if (r.faellig_am && new Date(r.faellig_am + 'T00:00:00') < new Date()) return 'ueberfaellig'
  return 'offen'
}

function useRechnungen() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-rechnungen', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('rechnungen').select('*').eq('schule_id', schule.id).order('erstellt_am', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function useFormat() {
  const { lang } = useApp()
  const loc = LOCALE[lang] ?? 'de-DE'
  return {
    euro: v => Number(v || 0).toLocaleString(loc, { style: 'currency', currency: 'EUR' }),
    tag: d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : '–',
  }
}

function BezahltBlatt({ r, onClose, onFertig }) {
  const { T, toast } = useApp()
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))
  const [weg, setWeg] = useState(r.zahlungsweg ?? 'ueberweisung')
  const [sendet, setSendet] = useState(false)

  async function speichern() {
    setSendet(true)
    const { error } = await supabase.from('rechnungen').update({ bezahlt_am: datum, zahlungsweg: weg }).eq('id', r.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nf_als_bezahlt_ok'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={T('nf_als_bezahlt')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('nf_eingangsdatum')}>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('nf_zahlungsweg')}>
          <select value={weg} onChange={e => setWeg(e.target.value)} style={eingabeStil}>
            {WEGE.map(w => <option key={w} value={w}>{T(`nf_weg_${w}`)}</option>)}
          </select>
        </Feld>
        <Knopf voll icon={CircleCheck} onClick={speichern} disabled={sendet || !datum}>{T('nf_als_bezahlt')}</Knopf>
      </div>
    </Blatt>
  )
}

// Neue Freitext-Rechnung (Logik wie NeueRechnungModal in pages/admin/Rechnungen.jsx)
function NeueRechnungBlatt({ schuleId, onClose, onGespeichert }) {
  const { T } = useApp()
  const { euro } = useFormat()
  const in14 = new Date(); in14.setDate(in14.getDate() + 14)
  const [form, setForm] = useState({
    empfaenger_name: '', empfaenger_adresse: '',
    positionen: [{ beschreibung: '', menge: 1, einzelpreis: '' }],
    steuersatz: '0', faellig_am: in14.toISOString().slice(0, 10), notizen: '',
  })
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  const { netto, mwst, brutto } = calcTotals(form.positionen, form.steuersatz)

  const posSetzen = (i, k, v) => setze('positionen', form.positionen.map((p, j) => j === i ? { ...p, [k]: v } : p))
  const posEntfernen = i => setze('positionen', form.positionen.filter((_, j) => j !== i))
  const posHinzu = () => setze('positionen', [...form.positionen, { beschreibung: '', menge: 1, einzelpreis: '' }])

  async function speichern() {
    if (!form.empfaenger_name.trim()) return setFehler(T('nf_fehler_empfaenger'))
    if (form.positionen.some(p => !p.beschreibung.trim() || !String(p.einzelpreis).trim())) return setFehler(T('nf_fehler_positionen'))
    if (brutto <= 0) return setFehler(T('nf_fehler_betrag'))
    setSendet(true); setFehler('')
    const { error } = await supabase.from('rechnungen').insert({
      schule_id: schuleId,
      empfaenger_name: form.empfaenger_name.trim(),
      empfaenger_adresse: form.empfaenger_adresse.trim() || null,
      positionen: form.positionen,
      betrag: brutto,
      steuersatz: Number(form.steuersatz),
      faellig_am: form.faellig_am || null,
      notizen: form.notizen.trim() || null,
      typ: 'freitext',
    })
    setSendet(false)
    if (error) return setFehler(error.message)
    onGespeichert()
  }

  const klein = { fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }
  const satz = Number(form.steuersatz)

  return (
    <Blatt titel={T('nf_neue_rechnung')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('nf_empfaenger')}>
          <input value={form.empfaenger_name} onChange={e => setze('empfaenger_name', e.target.value)} placeholder={T('nf_empfaenger_beispiel')} style={eingabeStil} />
        </Feld>
        <Feld label={T('nf_adresse')}>
          <textarea rows={2} value={form.empfaenger_adresse} onChange={e => setze('empfaenger_adresse', e.target.value)} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{T('nf_positionen')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {form.positionen.map((p, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 16, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input aria-label={T('nf_beschreibung')} placeholder={T('nf_beschreibung')} value={p.beschreibung} onChange={e => posSetzen(i, 'beschreibung', e.target.value)} style={{ ...eingabeStil, flex: 1 }} />
                  {form.positionen.length > 1 && (
                    <button onClick={() => posEntfernen(i)} aria-label={T('nf_position_entfernen')} style={{ width: 44, height: 52, flexShrink: 0, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={20} /></button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={klein}>{T('nf_menge')}</span>
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={p.menge} onChange={e => posSetzen(i, 'menge', e.target.value)} style={eingabeStil} />
                  </label>
                  <label style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={klein}>{T('nf_einzelpreis')}</span>
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={p.einzelpreis} onChange={e => posSetzen(i, 'einzelpreis', e.target.value)} style={eingabeStil} />
                  </label>
                  <div style={{ flex: 1.3, textAlign: 'right', paddingBottom: 14, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {euro((Number(p.menge) || 0) * (Number(p.einzelpreis) || 0))}
                  </div>
                </div>
              </div>
            ))}
            <Knopf variante="tint" icon={Plus} onClick={posHinzu}>{T('nf_zeile_hinzu')}</Knopf>
          </div>
        </div>

        <Feld label={T('nf_steuersatz')}>
          <Segment label={T('nf_steuersatz')} wert={form.steuersatz} onChange={v => setze('steuersatz', v)}
            optionen={[['0', T('nf_steuerbefreit')], ['7', '7 %'], ['19', '19 %']]} />
        </Feld>

        <Gruppe style={{ margin: 0 }}>
          {satz > 0 && (
            <>
              <div style={summenZeile}><span style={{ color: 'var(--text-2)' }}>{T('nf_netto')}</span><span>{euro(netto)}</span></div>
              <Trenner />
              <div style={summenZeile}><span style={{ color: 'var(--text-2)' }}>{T('nf_mwst').replace('{n}', form.steuersatz)}</span><span>{euro(mwst)}</span></div>
              <Trenner />
            </>
          )}
          <div style={{ ...summenZeile, fontSize: 20, fontWeight: 800 }}><span>{T('nf_gesamt')}</span><span>{euro(brutto)}</span></div>
        </Gruppe>

        <Feld label={T('nf_faellig')}>
          <input type="date" value={form.faellig_am} onChange={e => setze('faellig_am', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('nf_notizen_rechnung')}>
          <textarea rows={2} value={form.notizen} onChange={e => setze('notizen', e.target.value)} placeholder={T('nf_notizen_beispiel')} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={speichern} disabled={sendet}>{sendet ? T('saving') : T('nf_rechnung_erstellen')}</Knopf>
      </div>
    </Blatt>
  )
}

const summenZeile = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', fontSize: 17 }

function Detail({ r, onBezahlt, onStorno }) {
  const { T, schule } = useApp()
  const { euro, tag } = useFormat()
  const { netto, mwst, brutto } = calcTotals(r.positionen, r.steuersatz)
  const st = status(r)
  const satz = Number(r.steuersatz ?? 0)
  const adresse = r.empfaenger_snapshot?.adresse ?? r.empfaenger_adresse

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--text-2)' }}>{r.rechnungsnummer}</div>
      <h2 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{empfName(r)}</h2>
      <div style={{ marginTop: 2, fontSize: 16, fontWeight: 700, color: STATUS_FARBE[st] }}>
        {T(`nf_status_${st}`)}{r.bezahlt_am ? ` · ${tag(r.bezahlt_am)}` : ''}
      </div>
      <div style={{ marginTop: 10, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', textDecoration: r.storniert_am ? 'line-through' : 'none' }}>{euro(brutto)}</div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {st !== 'bezahlt' && st !== 'storniert' && <Knopf icon={CircleCheck} onClick={onBezahlt} style={{ flex: '1 1 160px' }}>{T('nf_als_bezahlt')}</Knopf>}
        <Knopf variante="sekundaer" icon={Printer} onClick={() => druckeRechnung(r, schule)} style={{ flex: '1 1 120px' }}>{T('nf_drucken')}</Knopf>
      </div>

      <DetailTitel>{T('nf_positionen')}</DetailTitel>
      <DetailGruppe>
        {(r.positionen ?? []).map((p, i) => (
          <div key={i}>
            {i > 0 && <Trenner />}
            <div style={{ padding: '12px 16px', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, overflowWrap: 'anywhere' }}><span style={{ color: 'var(--text-2)' }}>{p.menge}× </span>{p.beschreibung}</span>
              <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>{euro((Number(p.menge) || 0) * (Number(p.einzelpreis) || 0))}</span>
            </div>
          </div>
        ))}
        <Trenner />
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {satz > 0 && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--text-2)' }}><span>{T('nf_netto')}</span><span>{euro(netto)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--text-2)' }}><span>{T('nf_mwst').replace('{n}', satz)}</span><span>{euro(mwst)}</span></div>
          </>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800 }}><span>{T('nf_gesamt')}</span><span>{euro(brutto)}</span></div>
        </div>
      </DetailGruppe>

      <DetailTitel>{T('nv_details')}</DetailTitel>
      <DetailGruppe>
        <Info label={T('nf_ausgestellt')}>{tag(r.ausgestellt_am)}</Info>
        <Trenner /><Info label={T('nf_faellig')}>{tag(r.faellig_am)}</Info>
        {adresse && <><Trenner /><Info label={T('profile_address')}>{adresse}</Info></>}
        {r.zahlungsweg && r.bezahlt_am && <><Trenner /><Info label={T('nf_zahlungsweg')}>{T(`nf_weg_${r.zahlungsweg}`)}</Info></>}
        {r.notizen && <><Trenner /><Info label={T('notes')}>{r.notizen}</Info></>}
        {r.storniert_am && <><Trenner /><Info label={T('nf_storniert_am')}>{tag(r.storniert_am)}</Info></>}
      </DetailGruppe>

      {!r.storniert_am && (
        <div style={{ marginTop: 24 }}>
          <Knopf voll variante="gefahr" icon={Ban} onClick={onStorno}>{T('nf_stornieren')}</Knopf>
          <div style={{ marginTop: 8, fontSize: 15, color: 'var(--text-2)' }}>{T('nf_storno_hinweis')}</div>
        </div>
      )}
    </div>
  )
}

export default function AdminFinanzen() {
  const { T, profil, schule, toast, confirm } = useApp()
  const navigate = useNavigate()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { euro, tag } = useFormat()
  const { data: rechnungen = [], isLoading } = useRechnungen()
  const [filter, setFilter] = useState('alle')
  const [suche, setSuche] = useState('')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [modal, setModal] = useState(null)   // 'neu' | 'bezahlt'

  const q = suche.trim().toLowerCase()
  const liste = rechnungen
    .filter(r => filter === 'alle' || (filter === 'offen' ? ['offen', 'ueberfaellig'].includes(status(r)) : status(r) === filter))
    .filter(r => !q || empfName(r).toLowerCase().includes(q) || (r.rechnungsnummer ?? '').toLowerCase().includes(q))
  const gewaehlt = rechnungen.find(r => r.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-rechnungen', 'na-start')
  const anzahl = st => rechnungen.filter(r => status(r) === st).length
  const offenSumme = rechnungen.filter(r => ['offen', 'ueberfaellig'].includes(status(r))).reduce((s, r) => s + Number(r.betrag || 0), 0)

  async function stornieren(r) {
    if (!await confirm(T('nf_storno_frage').replace('{nr}', r.rechnungsnummer), { sub: T('nf_storno_hinweis'), confirmLabel: T('nf_stornieren') })) return
    const { error } = await supabase.from('rechnungen').update({ storniert_am: new Date().toISOString(), storniert_von: profil.id }).eq('id', r.id)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nf_storniert_ok'), 'info')
    aktualisieren()
  }

  const chips = [
    ['alle', T('n_alle')],
    ['offen', `${T('nf_status_offen')} (${anzahl('offen') + anzahl('ueberfaellig')})`],
    ...(anzahl('ueberfaellig') ? [['ueberfaellig', `${T('nf_status_ueberfaellig')} (${anzahl('ueberfaellig')})`]] : []),
    ['bezahlt', T('nf_status_bezahlt')],
    ...(anzahl('storniert') ? [['storniert', T('nf_status_storniert')]] : []),
  ]

  return (
    <Seite breit titel={T('nf_rechnungen')} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setModal('neu')}>{T('nv_neu')}</Knopf>}>
      {!schule?.steuernummer && !schule?.ustid && (
        <div role="alert" style={{ margin: '16px 20px 0', padding: 16, borderRadius: 18, background: 'color-mix(in srgb, #F59E0B 16%, var(--bg))', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TriangleAlert aria-hidden="true" size={24} color="#B45309" style={{ flexShrink: 0 }} />
          <div style={{ flex: '1 1 240px' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{T('nf_steuer_fehlt')}</div>
            <div style={{ fontSize: 16, color: 'var(--text-2)', marginTop: 2 }}>{T('nf_steuer_fehlt_text')}</div>
          </div>
          <Knopf klein variante="sekundaer" onClick={() => navigate('/admin/einstellungen')}>{T('nf_zu_den_angaben')}</Knopf>
        </div>
      )}

      <div style={{ margin: '16px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[[T('nf_offen_summe'), euro(offenSumme), 'var(--text)'], [T('nf_status_ueberfaellig'), anzahl('ueberfaellig'), anzahl('ueberfaellig') ? STATUS_FARBE.ueberfaellig : 'var(--text)']].map(([l, w, f]) => (
          <div key={l} style={{ padding: 16, borderRadius: 18, background: 'var(--n-fill)' }}>
            <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: f }}>{w}</div>
          </div>
        ))}
      </div>

      <ListeDetail breit={breit} detailLabel={gewaehlt?.rechnungsnummer} blattTitel={T('nf_rechnungen')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!modal}
        detail={gewaehlt && <Detail key={gewaehlt.id} r={gewaehlt} onBezahlt={() => setModal('bezahlt')} onStorno={() => stornieren(gewaehlt)} />}
        liste={<>
          <Suchfeld wert={suche} onChange={setSuche} label={T('nf_suchen')} placeholder={T('nf_suchen_platzhalter')} />
          <div style={{ marginTop: 12 }}><Chips label={T('status')} optionen={chips} wert={filter} onChange={setFilter} /></div>
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={300} /> : liste.length === 0 ? <Leer text={rechnungen.length ? T('nf_keine_gefunden') : T('nf_noch_keine')} /> : (
              <Gruppe>
                {liste.map((r, i) => {
                  const st = status(r)
                  return (
                    <div key={r.id} style={{ background: breit && gewaehlt?.id === r.id ? 'var(--n-tint)' : undefined, opacity: st === 'storniert' ? 0.6 : 1 }}>
                      {i > 0 && <Trenner />}
                      <Zeile titel={empfName(r)} chevron={!breit} onClick={() => setGewaehltId(r.id)}
                        untertitel={`${r.rechnungsnummer ?? ''} · ${euro(r.betrag)} · ${T('nf_faellig')} ${tag(r.faellig_am)}`}
                        wert={T(`nf_status_${st}`)} wertFarbe={STATUS_FARBE[st]} />
                    </div>
                  )
                })}
              </Gruppe>
            )}
          </div>
        </>} />

      {modal === 'neu' && (
        <NeueRechnungBlatt schuleId={schule?.id} onClose={() => setModal(null)}
          onGespeichert={() => { setModal(null); aktualisieren(); toast(T('nf_erstellt_ok'), 'success') }} />
      )}
      {modal === 'bezahlt' && gewaehlt && <BezahltBlatt r={gewaehlt} onClose={() => setModal(null)} onFertig={() => { setModal(null); aktualisieren() }} />}
    </Seite>
  )
}
