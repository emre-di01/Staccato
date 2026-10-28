import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Zeile, Segment, LiedCover, Leer, Laden } from '../../ui'
import { useNeuLaden } from '../daten'
import { useBasis, useSchulweit } from '../rolle'
import { useLehrerKurse } from '../lehrerDaten'
import { kursZeit } from './kursZeit'
import KursBlatt from './KursBlatt'

const GRUPPE = ['gruppe', 'chor', 'ensemble']

export default function LehrerKurse() {
  const { profil, T, lang } = useApp()
  const basis = useBasis()
  const schulweit = useSchulweit()
  const { data: kurse = [], isLoading } = useLehrerKurse()
  const [filter, setFilter] = useState('alle')
  const [anlegen, setAnlegen] = useState(false)
  const navigate = useNavigate()
  const neuLaden = useNeuLaden()

  const aktive = kurse.filter(k => k.aktiv !== false)
  const gemischt = aktive.some(k => GRUPPE.includes(k.typ)) && aktive.some(k => !GRUPPE.includes(k.typ))
  const liste = aktive.filter(k => filter === 'alle' || (filter === 'gruppe') === GRUPPE.includes(k.typ))
  const schuelerGesamt = new Set(aktive.flatMap(k => (k.unterricht_schueler ?? []).filter(s => s.status === 'aktiv').map(s => s.schueler_id))).size

  return (
    <Seite titel={T('nl_tab_kurse')} rechts={(schulweit || profil?.kann_kurse_anlegen) && (
      <button onClick={() => setAnlegen(true)} aria-label={T('nl_kurs_anlegen')} style={{ width: 44, height: 44, borderRadius: 22, border: 'none', cursor: 'pointer', background: 'var(--n-fill)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Plus aria-hidden="true" size={22} strokeWidth={2.2} />
      </button>
    )}>
      {gemischt && (
        <Segment label={T('n_filter')} wert={filter} onChange={setFilter} style={{ margin: '16px 20px 0' }}
          optionen={[['alle', T('n_alle')], ['gruppe', T('nl_gruppen')], ['einzel', T('nl_einzeln')]]} />
      )}

      <div style={{ margin: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLoading ? <Laden hoehe={260} /> : liste.length === 0 ? <Leer text={T('nl_keine_kurse')} /> : liste.map(k => (
          <Link key={k.id} to={`${basis}/kurse/${k.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, background: 'var(--n-fill)', color: 'var(--text)', textDecoration: 'none' }}>
            <LiedCover id={k.id} groesse={64} radius={16} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 700, overflowWrap: 'anywhere' }}>{k.name}</span>
              {kursZeit(k, lang) && <span style={{ display: 'block', fontSize: 15, color: 'var(--text-2)' }}>{[kursZeit(k, lang), k.raeume?.name].filter(Boolean).join(' · ')}</span>}
              {schulweit && k.lehrer?.length > 0 && <span style={{ display: 'block', fontSize: 15, color: 'var(--text-2)', overflowWrap: 'anywhere' }}>{k.lehrer.join(', ')}</span>}
              <span style={{ display: 'block', marginTop: 2, fontSize: 15, color: 'var(--text-2)' }}>
                {k.typ === 'einzel' ? T('nl_einzelunterricht') : T('nl_teilnehmer_n').replace('{n}', k.teilnehmer)}
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={20} color="var(--n-chev)" />
          </Link>
        ))}
      </div>

      {schuelerGesamt > 0 && !schulweit && (
        <Abschnitt titel={T('my_students')}>
          <Gruppe>
            <Zeile icon={Users} titel={T('nl_schueler_in_kursen').replace('{n}', schuelerGesamt).replace('{k}', aktive.length)} to="/lehrer/schueler" />
          </Gruppe>
        </Abschnitt>
      )}

      {anlegen && (
        <KursBlatt onClose={() => setAnlegen(false)} onFertig={id => {
          setAnlegen(false)
          neuLaden('nl-kurse', 'nl-stunden')
          if (id) navigate(`${basis}/kurse/${id}`)
        }} />
      )}
    </Seite>
  )
}
