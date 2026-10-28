import { Target, FileText, Package, CalendarClock, CircleDot } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { useVorstandUebersicht } from './daten'
import { tagLabel, uhrzeit, kalenderFormat } from '../zeit'

// Reiter „Vorstand“: eigene Aufgaben, nächste Sitzung und die Vorstandsbereiche
export default function VorstandBereich() {
  const { T, lang, zeitzone, abo } = useApp()
  const { data, isLoading } = useVorstandUebersicht()
  const sitzung = data?.naechsteSitzung

  const bereiche = [
    { to: '/vorstand/ziele', icon: Target, farbe: 'var(--primary)', label: 'vorstand_ziele', wert: data?.offeneAufgaben ? T('nvs_x_offen').replace('{n}', data.offeneAufgaben) : null },
    { to: '/vorstand/protokolle', icon: FileText, farbe: '#2563EB', label: 'vorstand_protokolle', wert: data?.protokolle ? String(data.protokolle) : null },
    ...(abo?.hatInventar !== false ? [{ to: '/vorstand/inventar', icon: Package, farbe: '#15803D', label: 'inv_title', hinweis: 'na_inventar_hinweis' }] : []),
  ]

  return (
    <Seite titel={T('na_vorstand')}>
      <Abschnitt titel={T('vorstand_naechste_sitzung')} style={{ marginTop: 24 }}>
        {isLoading ? <Laden hoehe={72} /> : sitzung ? (
          <Gruppe>
            <Zeile icon={CalendarClock} iconFarbe="#2563EB" titel={sitzung.titel} chevron={false}
              untertitel={[`${tagLabel(sitzung.beginn, zeitzone, lang, T)} · ${uhrzeit(sitzung.beginn, zeitzone, lang)}`, sitzung.ort || sitzung.raeume?.name].filter(Boolean).join(' · ')} />
          </Gruppe>
        ) : <Leer text={T('nvs_keine_sitzung')} />}
      </Abschnitt>

      <Abschnitt titel={T('nvs_meine_aufgaben')}>
        {isLoading ? <Laden /> : !data?.meineAufgaben.length ? <Leer text={T('nvs_keine_aufgaben')} /> : (
          <Gruppe>
            {data.meineAufgaben.map((a, i) => (
              <div key={a.id}>
                {i > 0 && <Trenner />}
                <Zeile icon={CircleDot} iconFarbe={a.status === 'in_bearbeitung' ? 'var(--warning)' : 'var(--primary)'} titel={a.titel} to="/vorstand/ziele"
                  untertitel={[T(`vorstand_status_${a.status}`), a.faellig_am && T('nvs_faellig').replace('{datum}', kalenderFormat(a.faellig_am, lang, { day: 'numeric', month: 'short' }))].filter(Boolean).join(' · ')} />
              </div>
            ))}
          </Gruppe>
        )}
      </Abschnitt>

      <Abschnitt titel={T('nvs_bereiche')}>
        <Gruppe>
          {bereiche.map((b, i) => (
            <div key={b.to}>
              {i > 0 && <Trenner />}
              <Zeile icon={b.icon} iconFarbe={b.farbe} titel={T(b.label)} untertitel={b.hinweis ? T(b.hinweis) : null} wert={b.wert} to={b.to} />
            </div>
          ))}
        </Gruppe>
      </Abschnitt>
    </Seite>
  )
}
