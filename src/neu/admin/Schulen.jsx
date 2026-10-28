import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, ArrowRightLeft, Settings2, Trash2, Power } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Suchfeld, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, Feld, SchalterZeile, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { useBreit, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const PLAENE = ['solo', 'starter', 'verein', 'pro', 'enterprise']
const ABO_STATUS = ['aktiv', 'trial', 'gesperrt']

export function useAlleSchulen() {
  return useQuery({
    queryKey: ['na-alle-schulen'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alle_schulen_stats')
      if (error) throw error
      return (data ?? []).sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

function SchulLogo({ s, groesse = 40 }) {
  if (s.logo_url) return <img src={s.logo_url} alt="" style={{ width: groesse, height: groesse, borderRadius: groesse * 0.28, objectFit: 'cover', flexShrink: 0, background: '#FFFFFF' }} />
  return (
    <span aria-hidden="true" style={{ width: groesse, height: groesse, borderRadius: groesse * 0.28, flexShrink: 0, background: s.farbe ?? 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: groesse * 0.42, fontWeight: 800 }}>
      {s.name?.charAt(0).toUpperCase()}
    </span>
  )
}

function NeueSchuleBlatt({ onClose, onFertig }) {
  const { T, toast } = useApp()
  const [form, setForm] = useState({ name: '', adresse: '', email: '', telefon: '' })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function anlegen() {
    if (!form.name.trim()) { toast(T('name_required'), 'error'); return }
    setSendet(true)
    const { error } = await supabase.rpc('schule_anlegen', { p_name: form.name.trim(), p_adresse: form.adresse, p_email: form.email, p_telefon: form.telefon, p_farbe: null })
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('school_created'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={T('create_school')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('settings_school_name')}><input value={form.name} onChange={e => setze('name', e.target.value)} style={eingabeStil} /></Feld>
        <Feld label={T('profile_address')}><input value={form.adresse} onChange={e => setze('adresse', e.target.value)} style={eingabeStil} /></Feld>
        <Feld label={T('email')}><input type="email" value={form.email} onChange={e => setze('email', e.target.value)} style={eingabeStil} /></Feld>
        <Feld label={T('profile_phone')}><input type="tel" value={form.telefon} onChange={e => setze('telefon', e.target.value)} style={eingabeStil} /></Feld>
        <Knopf voll onClick={anlegen} disabled={sendet}>{T('create_school')}</Knopf>
      </div>
    </Blatt>
  )
}

function PlanBlatt({ s, onClose, onFertig }) {
  const { T, toast } = useApp()
  const [form, setForm] = useState({
    plan: s.plan ?? 'pro', abo_status: s.abo_status ?? 'aktiv', abo_bis: s.abo_bis ?? '',
    verein_verifiziert: s.verein_verifiziert ?? false, hat_vorstand: s.hat_vorstand ?? true, hat_inventar: s.hat_inventar ?? true,
    max_lehrer: s.max_lehrer ?? '', max_schueler: s.max_schueler ?? '', max_storage_mb: s.max_storage_mb ?? '',
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const zahl = v => v !== '' && v != null ? parseInt(v) : null

  async function speichern() {
    setSendet(true)
    const { error } = await supabase.from('schulen').update({
      ...form, abo_bis: form.abo_bis || null,
      max_lehrer: zahl(form.max_lehrer), max_schueler: zahl(form.max_schueler), max_storage_mb: zahl(form.max_storage_mb),
    }).eq('id', s.schule_id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nl_gespeichert'), 'success')
    onFertig()
  }

  const grenze = (k, label) => (
    <Feld label={label}>
      <input type="number" inputMode="numeric" min={0} value={form[k]} placeholder="∞" onChange={e => setze(k, e.target.value)} style={eingabeStil} />
    </Feld>
  )

  return (
    <Blatt titel={`${T('nsa_plan')}: ${s.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Feld label={T('nsa_plan')}>
            <select value={form.plan} onChange={e => setze('plan', e.target.value)} style={eingabeStil}>
              {PLAENE.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Feld>
          <Feld label={T('nsa_abo_status')}>
            <select value={form.abo_status} onChange={e => setze('abo_status', e.target.value)} style={eingabeStil}>
              {ABO_STATUS.map(a => <option key={a} value={a}>{T(`nsa_abo_${a}`)}</option>)}
            </select>
          </Feld>
        </div>
        <Feld label={T('nsa_abo_bis')}><input type="date" value={form.abo_bis} onChange={e => setze('abo_bis', e.target.value)} style={eingabeStil} /></Feld>
        <Gruppe style={{ margin: 0 }}>
          <SchalterZeile titel={T('nsa_hat_vorstand')} an={form.hat_vorstand} onChange={v => setze('hat_vorstand', v)} />
          <Trenner />
          <SchalterZeile titel={T('nsa_hat_inventar')} an={form.hat_inventar} onChange={v => setze('hat_inventar', v)} />
          <Trenner />
          <SchalterZeile titel={T('nsa_verein_verifiziert')} an={form.verein_verifiziert} onChange={v => setze('verein_verifiziert', v)} />
        </Gruppe>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          {grenze('max_lehrer', T('nsa_max_lehrer'))}
          {grenze('max_schueler', T('nsa_max_schueler'))}
          {grenze('max_storage_mb', T('nsa_max_speicher'))}
        </div>
        <Knopf voll onClick={speichern} disabled={sendet}>{T('save')}</Knopf>
      </div>
    </Blatt>
  )
}

function Detail({ s, istAktuell, onAktion, wechselt }) {
  const { T, lang } = useApp()
  const datum = d => d ? new Date(d).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <SchulLogo s={s} groesse={64} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{s.name}</h2>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
            {[s.plan, s.ist_demo ? T('nsa_demo') : null, !s.aktiv ? T('nsa_deaktiviert') : null, s.abo_status === 'gesperrt' ? T('nsa_abo_gesperrt') : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {istAktuell
          ? <Knopf onClick={() => onAktion('verwalten')} style={{ flex: '1 1 160px' }}>{T('manage_school')}</Knopf>
          : <Knopf icon={ArrowRightLeft} disabled={wechselt} onClick={() => onAktion('wechseln')} style={{ flex: '1 1 160px' }}>{wechselt ? '…' : T('switch_to_school')}</Knopf>}
        <Knopf variante="sekundaer" icon={Settings2} onClick={() => onAktion('plan')} style={{ flex: '1 1 120px' }}>{T('nsa_plan')}</Knopf>
      </div>

      <DetailTitel>{T('nsa_ueberblick')}</DetailTitel>
      <DetailGruppe>
        <Info label={T('members')}>{String(s.mitglieder_anzahl ?? 0)}</Info>
        <Trenner /><Info label={T('last_activity')}>{datum(s.letzte_aktivitaet)}</Info>
        {s.ist_demo && s.demo_expires_at && <><Trenner /><Info label={T('nsa_demo_bis')}>{datum(s.demo_expires_at)}</Info></>}
        {s.abo_bis && <><Trenner /><Info label={T('nsa_abo_bis')}>{datum(s.abo_bis)}</Info></>}
      </DetailGruppe>

      <DetailTitel>{T('nm_weiteres')}</DetailTitel>
      <DetailGruppe>
        <Zeile icon={Power} iconFarbe={s.aktiv ? 'var(--danger)' : 'var(--success)'} titel={s.aktiv ? T('nsa_deaktivieren') : T('nsa_aktivieren')}
          untertitel={s.aktiv ? T('nsa_deaktivieren_hinweis') : null} chevron={false} onClick={() => onAktion('aktiv')} />
      </DetailGruppe>
      <div style={{ marginTop: 20 }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={() => onAktion('loeschen')}>{T('nsa_loeschen')}</Knopf>
      </div>
    </div>
  )
}

export default function SuperadminSchulen() {
  const { T, schule, schuleWechseln, toast, confirm } = useApp()
  const navigate = useNavigate()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data: schulen = [], isLoading } = useAlleSchulen()
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('alle')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [blatt, setBlatt] = useState(null)   // 'neu' | 'plan'
  const [wechselt, setWechselt] = useState(false)

  const q = suche.trim().toLowerCase()
  const liste = schulen
    .filter(s => filter === 'alle' || (filter === 'demo' ? s.ist_demo : filter === 'inaktiv' ? !s.aktiv : !s.ist_demo && s.aktiv))
    .filter(s => !q || s.name.toLowerCase().includes(q))
  const gewaehlt = schulen.find(s => s.schule_id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-alle-schulen')

  async function aktion(typ) {
    const s = gewaehlt
    if (typ === 'plan') setBlatt('plan')
    else if (typ === 'verwalten') navigate('/admin')
    else if (typ === 'wechseln') {
      setWechselt(true)
      try { await schuleWechseln(s.schule_id); navigate('/admin', { replace: true }) }
      catch (e) { toast(e.message, 'error') }
      finally { setWechselt(false) }
    } else if (typ === 'aktiv') {
      if (s.aktiv && !await confirm(T('nsa_deaktivieren_frage').replace('{name}', s.name), { confirmLabel: T('nsa_deaktivieren') })) return
      const { error } = await supabase.from('schulen').update({ aktiv: !s.aktiv }).eq('id', s.schule_id)
      if (error) { toast(error.message, 'error'); return }
      aktualisieren()
    } else if (typ === 'loeschen') {
      if (!await confirm(T('nsa_loeschen_frage').replace('{name}', s.name), { sub: T('nsa_loeschen_hinweis'), confirmLabel: T('delete') })) return
      const { error } = await supabase.rpc('demo_schule_loeschen', { p_schule_id: s.schule_id })
      if (error) { toast(error.message, 'error'); return }
      setGewaehltId(null)
      aktualisieren()
    }
  }

  const anzahl = f => schulen.filter(f).length
  const chips = [
    ['alle', `${T('n_alle')} (${schulen.length})`],
    ['echt', `${T('nsa_kunden')} (${anzahl(s => !s.ist_demo && s.aktiv)})`],
    ...(anzahl(s => s.ist_demo) ? [['demo', `${T('nsa_demos')} (${anzahl(s => s.ist_demo)})`]] : []),
    ...(anzahl(s => !s.aktiv) ? [['inaktiv', `${T('nsa_deaktiviert')} (${anzahl(s => !s.aktiv)})`]] : []),
  ]

  return (
    <Seite breit titel={T('all_schools')} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setBlatt('neu')}>{T('nv_neu')}</Knopf>}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.name} blattTitel={T('all_schools')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!blatt}
        detail={gewaehlt && <Detail key={gewaehlt.schule_id} s={gewaehlt} istAktuell={schule?.id === gewaehlt.schule_id} onAktion={aktion} wechselt={wechselt} />}
        liste={<>
          <Suchfeld wert={suche} onChange={setSuche} label={T('nsa_suchen')} placeholder={T('settings_school_name')} />
          <div style={{ marginTop: 12 }}><Chips label={T('n_filter')} optionen={chips} wert={filter} onChange={setFilter} /></div>
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={300} /> : liste.length === 0 ? <Leer text={T('nsa_keine')} /> : (
              <Gruppe>
                {liste.map((s, i) => (
                  <div key={s.schule_id} style={{ background: breit && gewaehlt?.schule_id === s.schule_id ? 'var(--n-tint)' : undefined, opacity: s.aktiv ? 1 : 0.6 }}>
                    {i > 0 && <Trenner />}
                    <Zeile bild={<SchulLogo s={s} />} titel={s.name} chevron={!breit} onClick={() => setGewaehltId(s.schule_id)}
                      untertitel={[T('nsa_mitglieder_n').replace('{n}', s.mitglieder_anzahl ?? 0), s.plan, s.ist_demo ? T('nsa_demo') : null].filter(Boolean).join(' · ')}
                      wert={schule?.id === s.schule_id ? T('nsa_aktuell') : null} wertFarbe="var(--primary)" />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>
        </>} />

      {blatt === 'neu' && <NeueSchuleBlatt onClose={() => setBlatt(null)} onFertig={() => { setBlatt(null); aktualisieren() }} />}
      {blatt === 'plan' && gewaehlt && <PlanBlatt s={gewaehlt} onClose={() => setBlatt(null)} onFertig={() => { setBlatt(null); aktualisieren() }} />}
    </Seite>
  )
}
