import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Tag, ScanLine, Tags, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Suchfeld, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden } from '../../ui'
import { useNeuLaden } from '../daten'
import { ZUSTAENDE, etikettenDrucken } from '../../pages/admin/Inventar'
import { KategorienBlatt, InventarBlatt, EtikettBlatt, ScannerVollbild } from './InventarBlaetter'
import { useBreit, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const zFarbe = z => ZUSTAENDE.find(x => x.wert === z)?.farbe ?? 'var(--text-2)'

function useInventar() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-inventar', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const [k, i] = await Promise.all([
        supabase.from('inventar_kategorien').select('*').eq('schule_id', schule.id).order('name'),
        supabase.from('inventar').select('*, inventar_kategorien(id, name, icon)').eq('schule_id', schule.id).order('laufnummer'),
      ])
      if (i.error) throw i.error
      return { kategorien: k.data ?? [], items: i.data ?? [] }
    },
  })
}

function Symbol({ icon, groesse = 40 }) {
  return (
    <span aria-hidden="true" style={{ width: groesse, height: groesse, borderRadius: groesse * 0.3, background: groesse > 50 ? 'var(--n-tint)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: groesse * 0.55, flexShrink: 0 }}>
      {icon || <Package size={groesse * 0.5} color="var(--text-2)" />}
    </span>
  )
}

function Detail({ item, onAktion }) {
  const { T, lang } = useApp()
  const loc = LOCALE[lang] ?? 'de-DE'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Symbol icon={item.inventar_kategorien?.icon} groesse={64} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{item.inventarnummer}</div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{item.name}</h2>
          <div style={{ fontSize: 16, fontWeight: 600, color: zFarbe(item.zustand) }}>{T(`inv_condition_${item.zustand}`)}</div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf icon={Pencil} onClick={() => onAktion('bearbeiten')} style={{ flex: '1 1 140px' }}>{T('edit')}</Knopf>
        <Knopf variante="sekundaer" icon={Tag} onClick={() => onAktion('etikettEinzel')} style={{ flex: '1 1 140px' }}>{T('nv_etikett')}</Knopf>
      </div>

      <DetailTitel>{T('nv_details')}</DetailTitel>
      <DetailGruppe>
        <Info label={T('inv_col_cat')}>{item.inventar_kategorien ? item.inventar_kategorien.name : T('inv_filter_no_cat')}</Info>
        {item.hersteller && <><Trenner /><Info label={T('inv_field_brand')}>{item.hersteller}</Info></>}
        {item.seriennummer && <><Trenner /><Info label={T('inv_field_serial')}>{item.seriennummer}</Info></>}
        {item.barcode && <><Trenner /><Info label={T('inv_field_barcode')}>{item.barcode}</Info></>}
        {item.kaufdatum && <><Trenner /><Info label={T('inv_field_purchase_date')}>{new Date(item.kaufdatum).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })}</Info></>}
        {item.anschaffungswert != null && <><Trenner /><Info label={T('inv_field_value')}>{Number(item.anschaffungswert).toLocaleString(loc, { style: 'currency', currency: 'EUR' })}</Info></>}
      </DetailGruppe>

      {item.notizen && <>
        <DetailTitel>{T('inv_field_notes')}</DetailTitel>
        <DetailGruppe><Info label={T('inv_field_notes')}>{item.notizen}</Info></DetailGruppe>
      </>}

      <div style={{ marginTop: 24 }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={() => onAktion('loeschen')}>{T('nv_inventar_loeschen')}</Knopf>
      </div>
    </div>
  )
}

export default function AdminInventar() {
  const { T, schule, rolle, confirm, toast } = useApp()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data, isLoading } = useInventar()
  const kategorien = data?.kategorien ?? []
  const items = data?.items ?? []
  const [suche, setSuche] = useState('')
  const [kat, setKat] = useState('alle')
  const [zustand, setZustand] = useState('alle')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [modal, setModal] = useState(null)   // { typ, item? }

  const q = suche.trim().toLowerCase()
  const liste = items.filter(i =>
    (kat === 'alle' || (i.kategorie_id ?? 'keine') === kat) &&
    (zustand === 'alle' || i.zustand === zustand) &&
    (!q || [i.name, i.inventarnummer, i.seriennummer, i.barcode, i.hersteller].some(v => v?.toLowerCase().includes(q))),
  )
  const gewaehlt = items.find(i => i.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-inventar')

  const katChips = [
    ['alle', `${T('inv_filter_all')} (${items.length})`],
    ...kategorien.filter(k => items.some(i => i.kategorie_id === k.id)).map(k => [k.id, `${k.icon ?? ''} ${k.name}`.trim()]),
    ...(items.some(i => !i.kategorie_id) ? [['keine', T('inv_filter_no_cat')]] : []),
  ]
  const zustandChips = [['alle', T('nv_jeder_zustand')], ...ZUSTAENDE.filter(z => items.some(i => i.zustand === z.wert)).map(z => [z.wert, T(z.labelKey)])]

  async function loeschen(item) {
    if (!await confirm(T('nv_loeschen_frage').replace('{name}', `${item.name} (${item.inventarnummer})`), { confirmLabel: T('delete') })) return
    const { error } = await supabase.from('inventar').delete().eq('id', item.id)
    if (error) { toast(error.message, 'error'); return }
    setGewaehltId(null)
    aktualisieren()
  }

  const aktion = typ => typ === 'loeschen' ? loeschen(gewaehlt) : setModal({ typ, item: gewaehlt })
  const zu = () => setModal(null)

  return (
    <Seite breit titel={T('inv_title')} zurueck={rolle === 'vorstand' ? { to: '/vorstand/bereich', label: T('na_vorstand') } : undefined} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setModal({ typ: 'neu' })}>{T('nv_neu')}</Knopf>}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.name} blattTitel={T('inv_title')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!modal}
        detail={gewaehlt && <Detail key={gewaehlt.id} item={gewaehlt} onAktion={aktion} />}
        liste={<>
          <Suchfeld wert={suche} onChange={setSuche} label={T('nv_inventar_suchen')} placeholder={T('inv_search_placeholder')} />
          {katChips.length > 2 && <div style={{ marginTop: 12 }}><Chips label={T('inv_col_cat')} optionen={katChips} wert={kat} onChange={setKat} /></div>}
          {zustandChips.length > 2 && <div style={{ marginTop: 8 }}><Chips label={T('inv_col_condition')} optionen={zustandChips} wert={zustand} onChange={setZustand} /></div>}

          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={300} /> : liste.length === 0 ? <Leer text={items.length ? T('inv_empty_filtered') : T('inv_empty')} /> : (
              <Gruppe>
                {liste.map((i, n) => (
                  <div key={i.id} style={{ background: breit && gewaehlt?.id === i.id ? 'var(--n-tint)' : undefined }}>
                    {n > 0 && <Trenner />}
                    <Zeile bild={<Symbol icon={i.inventar_kategorien?.icon} />} titel={i.name} chevron={!breit}
                      untertitel={[i.inventarnummer, i.hersteller].filter(Boolean).join(' · ')}
                      wert={T(`inv_condition_${i.zustand}`)} wertFarbe={zFarbe(i.zustand)} onClick={() => setGewaehltId(i.id)} />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>

          <div style={{ margin: '14px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 15, color: 'var(--text-2)' }}>{T('nm_x_von_y').replace('{x}', liste.length).replace('{y}', items.length)}</span>
            <Knopf klein variante="sekundaer" icon={ScanLine} onClick={() => setModal({ typ: 'scanner' })}>{T('inv_scan')}</Knopf>
            <Knopf klein variante="sekundaer" icon={Tags} onClick={() => setModal({ typ: 'kategorien' })}>{T('inv_categories')}</Knopf>
            <Knopf klein variante="sekundaer" icon={Tag} disabled={!liste.length} onClick={() => etikettenDrucken(liste)}>{T('inv_labels')}</Knopf>
          </div>
        </>} />

      {(modal?.typ === 'neu' || modal?.typ === 'bearbeiten') && (
        <InventarBlatt item={modal.item ?? null} schuleId={schule?.id} kategorien={kategorien} onClose={zu} onErfolg={aktualisieren} />
      )}
      {modal?.typ === 'kategorien' && <KategorienBlatt schuleId={schule?.id} onClose={zu} onGeaendert={aktualisieren} />}
      {modal?.typ === 'etikettEinzel' && <EtikettBlatt item={modal.item} onClose={zu} />}
      {modal?.typ === 'scanner' && (
        <ScannerVollbild schuleId={schule?.id} onClose={zu} onBearbeiten={item => { setGewaehltId(item.id); setModal({ typ: 'bearbeiten', item }) }} />
      )}
    </Seite>
  )
}
