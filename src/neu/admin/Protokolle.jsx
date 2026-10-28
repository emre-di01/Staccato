import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Paperclip, FileText, Upload, X, CalendarHeart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Suchfeld, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden } from '../../ui'
import { useNeuLaden } from '../daten'
import { ProtokolModal } from '../../pages/vorstand/Protokolle'
import { useBreit, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TYPEN = ['vorstandssitzung', 'mitgliederversammlung', 'sonstiges']
const TYP_FARBE = { vorstandssitzung: '#7C3AED', mitgliederversammlung: '#2563EB', sonstiges: 'var(--text-2)' }

function useProtokolle() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-protokolle', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const [p, m] = await Promise.all([
        supabase.from('vorstand_protokolle').select('*, vorstand_protokoll_dateien(id)').eq('schule_id', schule.id).order('datum', { ascending: false }),
        supabase.from('profiles').select('id, voller_name').eq('schule_id', schule.id).in('rolle', ['vorstand', 'admin', 'superadmin']).order('voller_name'),
      ])
      return { protokolle: p.data ?? [], mitglieder: m.data ?? [] }
    },
  })
}

function useProtokollExtras(p) {
  return useQuery({
    queryKey: ['na-protokoll-dateien', p.id],
    queryFn: async () => {
      const [d, e] = await Promise.all([
        supabase.from('vorstand_protokoll_dateien').select('*').eq('protokoll_id', p.id).order('erstellt_am', { ascending: false }),
        p.event_id ? supabase.from('events').select('id, titel, beginn').eq('id', p.event_id).maybeSingle() : { data: null },
      ])
      return { dateien: d.data ?? [], event: e.data }
    },
  })
}

function Detail({ p, namen, onBearbeiten, onLoeschen }) {
  const { T, lang, schule, profil, toast, confirm } = useApp()
  const neuLaden = useNeuLaden()
  const { data } = useProtokollExtras(p)
  const eingabe = useRef(null)
  const [laedt, setLaedt] = useState(false)
  const loc = LOCALE[lang] ?? 'de-DE'
  const dateien = data?.dateien ?? []

  async function hochladen(datei) {
    if (!datei) return
    if (datei.size > 50 * 1024 * 1024) { toast(T('file_too_large').replace('{n}', 50), 'error'); return }
    setLaedt(true)
    const pfad = `${schule.id}/${p.id}/${Date.now()}_${datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('vorstand-dateien').upload(pfad, datei)
    if (!error) await supabase.from('vorstand_protokoll_dateien').insert({ protokoll_id: p.id, schule_id: schule.id, name: datei.name, bucket_pfad: pfad, erstellt_von: profil.id })
    setLaedt(false)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('na-protokoll-dateien', 'na-protokolle')
  }

  async function oeffnen(d) {
    const { data: url } = await supabase.storage.from('vorstand-dateien').createSignedUrl(d.bucket_pfad, 3600)
    if (url?.signedUrl) window.open(url.signedUrl, '_blank', 'noopener')
  }

  async function dateiLoeschen(d) {
    if (!await confirm(T('nv_loeschen_frage').replace('{name}', d.name), { confirmLabel: T('delete') })) return
    await supabase.storage.from('vorstand-dateien').remove([d.bucket_pfad])
    await supabase.from('vorstand_protokoll_dateien').delete().eq('id', d.id)
    neuLaden('na-protokoll-dateien', 'na-protokolle')
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: TYP_FARBE[p.sitzungstyp] ?? 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{T(`np_typ_${p.sitzungstyp}`)}</div>
      <h2 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{p.titel}</h2>
      <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{new Date(p.datum).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf icon={Pencil} onClick={onBearbeiten} style={{ flex: '1 1 140px' }}>{T('edit')}</Knopf>
      </div>

      {data?.event && <>
        <DetailTitel>{T('np_sitzung')}</DetailTitel>
        <DetailGruppe>
          <Zeile icon={CalendarHeart} iconFarbe="#7C3AED" titel={data.event.titel} chevron={false}
            untertitel={new Date(data.event.beginn).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })} />
        </DetailGruppe>
      </>}

      {p.teilnehmer_ids?.length > 0 && <>
        <DetailTitel>{T('vorstand_teilnehmer')}</DetailTitel>
        <DetailGruppe><Info label={T('np_anwesend_n').replace('{n}', p.teilnehmer_ids.length)}>{p.teilnehmer_ids.map(id => namen[id] ?? '?').join(', ')}</Info></DetailGruppe>
      </>}

      {p.beschluesse && <>
        <DetailTitel>{T('np_beschluesse')}</DetailTitel>
        <DetailGruppe><div style={{ padding: '12px 16px', fontSize: 17, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', borderLeft: '4px solid #7C3AED' }}>{p.beschluesse}</div></DetailGruppe>
      </>}

      {p.inhalt && <>
        <DetailTitel>{T('np_inhalt')}</DetailTitel>
        <DetailGruppe><div style={{ padding: '12px 16px', fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.inhalt}</div></DetailGruppe>
      </>}

      <DetailTitel>{T('np_anhaenge')}</DetailTitel>
      <DetailGruppe>
        {dateien.map(d => (
          <div key={d.id}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}><Zeile icon={FileText} titel={d.name} chevron={false} onClick={() => oeffnen(d)} /></div>
              <button onClick={() => dateiLoeschen(d)} aria-label={`${T('delete')}: ${d.name}`} style={{ width: 44, height: 44, marginRight: 6, borderRadius: 22, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <Trenner />
          </div>
        ))}
        <Zeile icon={Upload} titel={laedt ? T('np_laedt_hoch') : T('np_datei_anhaengen')} chevron={false} onClick={() => !laedt && eingabe.current?.click()} />
        <input ref={eingabe} type="file" hidden onChange={e => { hochladen(e.target.files?.[0]); e.target.value = '' }} />
      </DetailGruppe>

      <div style={{ marginTop: 24 }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={onLoeschen}>{T('np_loeschen')}</Knopf>
      </div>
    </div>
  )
}

export default function AdminProtokolle() {
  const { T, lang, profil, schule, toast, confirm } = useApp()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data, isLoading } = useProtokolle()
  const [suche, setSuche] = useState('')
  const [typ, setTyp] = useState('alle')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [modal, setModal] = useState(null)   // { protokoll } | { neu: true }

  const protokolle = data?.protokolle ?? []
  const mitglieder = data?.mitglieder ?? []
  const namen = Object.fromEntries(mitglieder.map(m => [m.id, m.voller_name]))
  const q = suche.trim().toLowerCase()
  const liste = protokolle
    .filter(p => typ === 'alle' || p.sitzungstyp === typ)
    .filter(p => !q || [p.titel, p.beschluesse, p.inhalt].some(v => v?.toLowerCase().includes(q)))
  const gewaehlt = protokolle.find(p => p.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-protokolle', 'na-start')

  async function loeschen(p) {
    if (!await confirm(T('nv_loeschen_frage').replace('{name}', p.titel), { confirmLabel: T('delete') })) return
    const { error } = await supabase.from('vorstand_protokolle').delete().eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    setGewaehltId(null)
    aktualisieren()
  }

  const chips = [['alle', T('n_alle')], ...TYPEN.filter(t => protokolle.some(p => p.sitzungstyp === t)).map(t => [t, T(`np_typ_${t}`)])]

  return (
    <Seite breit titel={T('vorstand_protokolle')} zurueck={{ to: '/admin/verwaltung', label: T('na_tab_verwaltung') }}
      rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setModal({ neu: true })}>{T('nv_neu')}</Knopf>}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.titel} blattTitel={T('vorstand_protokolle')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!modal}
        detail={gewaehlt && <Detail key={gewaehlt.id} p={gewaehlt} namen={namen} onBearbeiten={() => setModal({ protokoll: gewaehlt })} onLoeschen={() => loeschen(gewaehlt)} />}
        liste={<>
          <Suchfeld wert={suche} onChange={setSuche} label={T('np_suchen')} placeholder={T('np_suchen_platzhalter')} />
          {chips.length > 2 && <div style={{ marginTop: 12 }}><Chips label={T('type')} optionen={chips} wert={typ} onChange={setTyp} /></div>}
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={260} /> : liste.length === 0 ? <Leer text={T('vorstand_no_protokolle')} /> : (
              <Gruppe>
                {liste.map((p, i) => (
                  <div key={p.id} style={{ background: breit && gewaehlt?.id === p.id ? 'var(--n-tint)' : undefined }}>
                    {i > 0 && <Trenner />}
                    <Zeile titel={p.titel} chevron={!breit} onClick={() => setGewaehltId(p.id)}
                      untertitel={[new Date(p.datum).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'short', year: 'numeric' }), T(`np_typ_${p.sitzungstyp}`)].join(' · ')}
                      wert={p.vorstand_protokoll_dateien?.length ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Paperclip aria-label={T('np_anhaenge')} size={16} />{p.vorstand_protokoll_dateien.length}</span> : null} />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>
        </>} />

      {modal && (
        <ProtokolModal protokoll={modal.protokoll ?? null} vorstandMitglieder={mitglieder} schuleId={schule?.id} profilId={profil?.id} T={T}
          onClose={() => setModal(null)} onGespeichert={() => { setModal(null); aktualisieren() }} />
      )}
    </Seite>
  )
}
