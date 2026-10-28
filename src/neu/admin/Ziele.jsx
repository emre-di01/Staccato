import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Circle, CircleDot, CircleCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Chips, Trenner, Knopf, Leer, Laden } from '../../ui'
import { useNeuLaden } from '../daten'
import { ZielBlatt, AufgabeBlatt } from './VorstandBlaetter'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const STATUS = {
  offen:          { icon: Circle,      farbe: 'var(--text-2)' },
  in_bearbeitung: { icon: CircleDot,   farbe: '#2563EB' },
  erledigt:       { icon: CircleCheck, farbe: 'var(--success)' },
}
const NAECHSTER = { offen: 'in_bearbeitung', in_bearbeitung: 'erledigt', erledigt: 'offen' }

export function useVorstandZiele() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-ziele', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const [z, a, m] = await Promise.all([
        supabase.from('vorstand_ziele').select('*').eq('schule_id', schule.id).order('erstellt_am', { ascending: false }),
        supabase.from('vorstand_aufgaben').select('*').eq('schule_id', schule.id).order('erstellt_am'),
        supabase.from('profiles').select('id, voller_name').eq('schule_id', schule.id).in('rolle', ['vorstand', 'admin', 'superadmin']).order('voller_name'),
      ])
      return { ziele: z.data ?? [], aufgaben: a.data ?? [], mitglieder: m.data ?? [] }
    },
  })
}

const knopf = { width: 44, height: 44, borderRadius: 22, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

function ZielKarte({ ziel, aufgaben, namen, onAktion }) {
  const { T, lang } = useApp()
  const erledigt = aufgaben.filter(a => a.status === 'erledigt').length
  const anteil = aufgaben.length ? Math.round(100 * erledigt / aufgaben.length) : (ziel.status === 'erledigt' ? 100 : 0)
  const st = STATUS[ziel.status] ?? STATUS.offen

  return (
    <article style={{ margin: '0 20px', borderRadius: 20, background: 'var(--n-fill)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 8px 12px 18px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
            {ziel.zeitraum_wert} · <span style={{ color: st.farbe }}>{T(`vorstand_status_${ziel.status}`)}</span>
          </div>
          <h2 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }}>{ziel.titel}</h2>
          {ziel.beschreibung && <div style={{ marginTop: 4, fontSize: 16, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{ziel.beschreibung}</div>}
          {ziel.verantwortlicher_id && <div style={{ marginTop: 4, fontSize: 15, color: 'var(--text-2)' }}>{T('vorstand_verantwortlicher')}: {namen[ziel.verantwortlicher_id] ?? '–'}</div>}
        </div>
        <button onClick={() => onAktion('ziel', ziel)} aria-label={`${T('edit')}: ${ziel.titel}`} style={knopf}><Pencil aria-hidden="true" size={19} /></button>
        <button onClick={() => onAktion('zielLoeschen', ziel)} aria-label={`${T('delete')}: ${ziel.titel}`} style={knopf}><Trash2 aria-hidden="true" size={19} /></button>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <div role="progressbar" aria-valuenow={anteil} aria-valuemin={0} aria-valuemax={100} aria-label={T('nz_fortschritt')}
          style={{ height: 8, borderRadius: 4, background: 'var(--n-fill-2)', overflow: 'hidden' }}>
          <div style={{ width: `${anteil}%`, height: '100%', background: 'var(--success)' }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 15, color: 'var(--text-2)' }}>
          {aufgaben.length ? T('nz_aufgaben_erledigt').replace('{x}', erledigt).replace('{y}', aufgaben.length) : T('vorstand_no_aufgaben')}
        </div>
      </div>

      <div style={{ background: 'var(--bg)', margin: '0 8px 8px', borderRadius: 14, overflow: 'hidden' }}>
        {aufgaben.map((a, i) => {
          const as = STATUS[a.status] ?? STATUS.offen
          const Icon = as.icon
          return (
            <div key={a.id}>
              {i > 0 && <Trenner />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 56, padding: '4px 4px 4px 4px' }}>
                <button onClick={() => onAktion('status', a)} aria-label={`${a.titel}: ${T(`vorstand_status_${a.status}`)} – ${T('nz_status_wechseln')}`} style={{ ...knopf, color: as.farbe }}>
                  <Icon aria-hidden="true" size={26} strokeWidth={2} />
                </button>
                <button onClick={() => onAktion('aufgabe', a)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: '6px 4px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                  <span style={{ display: 'block', fontSize: 17, overflowWrap: 'anywhere', textDecoration: a.status === 'erledigt' ? 'line-through' : 'none', color: a.status === 'erledigt' ? 'var(--text-2)' : 'var(--text)' }}>{a.titel}</span>
                  {(a.verantwortlicher_id || a.faellig_am) && (
                    <span style={{ display: 'block', fontSize: 15, color: 'var(--text-2)' }}>
                      {[a.verantwortlicher_id ? namen[a.verantwortlicher_id] : null, a.faellig_am ? new Date(a.faellig_am + 'T00:00:00').toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'short' }) : null].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
                <button onClick={() => onAktion('aufgabeLoeschen', a)} aria-label={`${T('delete')}: ${a.titel}`} style={knopf}><Trash2 aria-hidden="true" size={18} /></button>
              </div>
            </div>
          )
        })}
        {aufgaben.length > 0 && <Trenner />}
        <button onClick={() => onAktion('neueAufgabe', ziel)} style={{ width: '100%', minHeight: 52, border: 'none', background: 'none', color: 'var(--primary)', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
          <Plus aria-hidden="true" size={22} />{T('vorstand_new_aufgabe')}
        </button>
      </div>
    </article>
  )
}

export default function AdminZiele() {
  const { T, profil, schule, rolle, toast, confirm } = useApp()
  const neuLaden = useNeuLaden()
  const { data, isLoading } = useVorstandZiele()
  const [zeitraum, setZeitraum] = useState('alle')
  const [modal, setModal] = useState(null)   // { typ: 'ziel'|'aufgabe', ziel?, aufgabe?, zielId? }

  const ziele = data?.ziele ?? []
  const aufgaben = data?.aufgaben ?? []
  const mitglieder = data?.mitglieder ?? []
  const namen = Object.fromEntries(mitglieder.map(m => [m.id, m.voller_name]))
  const zeitraeume = [...new Set(ziele.map(z => z.zeitraum_wert).filter(Boolean))].sort().reverse()
  const liste = zeitraum === 'alle' ? ziele : ziele.filter(z => z.zeitraum_wert === zeitraum)
  const aktualisieren = () => neuLaden('na-ziele', 'na-start')

  async function aktion(typ, x) {
    if (typ === 'ziel') setModal({ typ: 'ziel', ziel: x })
    else if (typ === 'aufgabe') setModal({ typ: 'aufgabe', aufgabe: x, zielId: x.ziel_id })
    else if (typ === 'neueAufgabe') setModal({ typ: 'aufgabe', aufgabe: null, zielId: x.id })
    else if (typ === 'status') {
      const { error } = await supabase.from('vorstand_aufgaben').update({ status: NAECHSTER[x.status] ?? 'offen' }).eq('id', x.id)
      if (error) { toast(error.message, 'error'); return }
      aktualisieren()
    } else if (typ === 'zielLoeschen' || typ === 'aufgabeLoeschen') {
      if (!await confirm(T('nv_loeschen_frage').replace('{name}', x.titel), { confirmLabel: T('delete') })) return
      const { error } = await supabase.from(typ === 'zielLoeschen' ? 'vorstand_ziele' : 'vorstand_aufgaben').delete().eq('id', x.id)
      if (error) { toast(error.message, 'error'); return }
      aktualisieren()
    }
  }

  const fertig = () => { setModal(null); aktualisieren() }

  return (
    <Seite titel={T('vorstand_ziele')} zurueck={rolle === 'vorstand' ? { to: '/vorstand/bereich', label: T('na_vorstand') } : { to: '/admin/verwaltung', label: T('na_tab_verwaltung') }}
      rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setModal({ typ: 'ziel', ziel: null })}>{T('nv_neu')}</Knopf>}>
      {zeitraeume.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <Chips label={T('vorstand_zeitraum_label')} optionen={[['alle', T('vorstand_alle_zeitraeume')], ...zeitraeume.map(z => [z, z])]} wert={zeitraum} onChange={setZeitraum} />
        </div>
      )}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isLoading ? <Laden hoehe={260} /> : liste.length === 0 ? <Leer text={T('vorstand_no_ziele')} /> : liste.map(z => (
          <ZielKarte key={z.id} ziel={z} aufgaben={aufgaben.filter(a => a.ziel_id === z.id)} namen={namen} onAktion={aktion} />
        ))}
      </div>

      {modal?.typ === 'ziel' && (
        <ZielBlatt ziel={modal.ziel} vorstandMitglieder={mitglieder} schuleId={schule?.id} profilId={profil?.id} onClose={() => setModal(null)} onGespeichert={fertig} />
      )}
      {modal?.typ === 'aufgabe' && (
        <AufgabeBlatt aufgabe={modal.aufgabe} zielId={modal.zielId} vorstandMitglieder={mitglieder} schuleId={schule?.id} profilId={profil?.id} onClose={() => setModal(null)} onGespeichert={fertig} />
      )}
    </Seite>
  )
}
