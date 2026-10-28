import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Chips, Suchfeld, Knopf, Zeile, LiedCover, LiedKachel, Regal, Leer, Laden } from '../../ui'
import LiedVorschlaege, { VorschlagModal } from '../../components/LiedVorschlaege'
import { useMeineKurse, useMeineLieder, useNeuLaden, liedInhalt } from '../daten'
import { useBasis } from '../rolle'

export default function NeuLieder() {
  const { T } = useApp()
  const basis = useBasis()
  const [params] = useSearchParams()
  const { data: kurse = [] } = useMeineKurse()
  const { data: lieder = [], isLoading } = useMeineLieder()
  const neuLaden = useNeuLaden()
  const [filter, setFilter] = useState(params.get('ansicht') === 'vorschlaege' ? 'vorschlaege' : 'alle')
  const [suche, setSuche] = useState('')
  const [vorschlagOffen, setVorschlagOffen] = useState(false)

  const q = suche.trim().toLowerCase()
  const liste = lieder
    .filter(l => filter === 'alle' || l.kurse.some(k => k.id === filter))
    .filter(l => !q || l.stueck.titel.toLowerCase().includes(q) || (l.stueck.komponist ?? '').toLowerCase().includes(q))
  const navState = { liste: liste.map(l => ({ id: l.stueck.id, titel: l.stueck.titel })) }
  const aktuell = lieder.filter(l => l.kurse.some(k => k.status === 'aktuell' && (filter === 'alle' || k.id === filter)))
  const aktuellState = { liste: aktuell.map(l => ({ id: l.stueck.id, titel: l.stueck.titel })) }

  // Filter je Kurs, sobald der Kurs Lieder hat – auch bei nur einem Kurs
  const kurseMitLiedern = kurse.filter(k => lieder.some(l => l.kurse.some(lk => lk.id === k.id)))
  const chips = [
    ['alle', T('n_alle')],
    ...kurseMitLiedern.map(k => [k.id, k.name]),
    ['vorschlaege', T('n_meine_vorschlaege')],
  ]

  return (
    <Seite titel={T('n_tab_lieder')} rechts={
      <Knopf klein variante="tint" icon={Plus} onClick={() => setVorschlagOffen(true)}>{T('n_vorschlagen')}</Knopf>
    }>
      {filter !== 'vorschlaege' && (
        <div style={{ marginTop: 16 }}>
          <Suchfeld wert={suche} onChange={setSuche} label={T('n_lieder_suchen')} placeholder={T('n_titel_oder_komponist')} />
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <Chips label={T('n_filter')} optionen={chips} wert={filter} onChange={setFilter} />
      </div>

      {filter === 'vorschlaege' ? (
        <div style={{ margin: '24px 20px 0' }}>
          <LiedVorschlaege modus="schueler" rollePfad="schueler" />
        </div>
      ) : isLoading ? (
        <div style={{ marginTop: 24 }}><Laden hoehe={200} /></div>
      ) : (
        <>
          {!q && aktuell.length > 0 && (
            <Abschnitt titel={T('n_aktuell_geprobt')} style={{ marginTop: 26 }}>
              <Regal>
                {aktuell.map(l => <LiedKachel key={l.stueck.id} stueck={l.stueck} to={`${basis}/repertoire/${l.stueck.id}`} state={aktuellState} />)}
              </Regal>
            </Abschnitt>
          )}
          <Abschnitt titel={T('n_alle_lieder')} style={{ marginTop: 26 }}>
            {liste.length === 0 ? (
              <Leer text={q ? T('n_kein_lied_gefunden') : T('n_noch_keine_lieder')} />
            ) : (
              <div>
                {liste.map(l => (
                  <div key={l.stueck.id} style={{ borderBottom: '1px solid var(--n-sep)', margin: '0 4px 0 4px' }}>
                    <Zeile bild={<LiedCover id={l.stueck.id} />} titel={l.stueck.titel}
                      untertitel={[l.stueck.komponist, liedInhalt(l.stueck, T)].filter(Boolean).join(' · ')}
                      to={`${basis}/repertoire/${l.stueck.id}`} state={navState} />
                  </div>
                ))}
              </div>
            )}
          </Abschnitt>
        </>
      )}

      {vorschlagOffen && (
        <VorschlagModal onClose={() => setVorschlagOffen(false)}
          onErfolg={() => { setVorschlagOffen(false); setFilter('vorschlaege'); neuLaden('lied-vorschlaege') }} />
      )}
    </Seite>
  )
}
