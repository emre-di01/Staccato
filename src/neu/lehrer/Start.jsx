import { Link } from 'react-router-dom'
import { Clock, MapPin, Users, Play, ClipboardCheck, Music, MessageCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { useOffeneVorschlaege } from '../../hooks/useOffeneVorschlaege'
import { useUngelesen } from '../daten'
import { useLehrerStunden, istOffen } from '../lehrerDaten'
import { uhrzeit, tagLabel, tagKey, datumLang, stundeDerSchule } from '../zeit'

export default function LehrerStart() {
  const { profil, T, lang, zeitzone } = useApp()
  const { data: stunden = [], isLoading } = useLehrerStunden({ zurueck: 30, tage: 7 })
  const { data: vorschlaege = 0 } = useOffeneVorschlaege()
  const { data: ungelesen = [] } = useUngelesen()

  const jetzt = Date.now()
  const heuteKey = tagKey(new Date().toISOString(), zeitzone)
  const heute = stunden.filter(s => tagKey(s.beginn, zeitzone) === heuteKey)
  const naechste = stunden.find(s => new Date(s.ende) > jetzt && s.status === 'geplant')
  const laeuft = naechste && new Date(naechste.beginn) <= jetzt
  const istHeute = naechste && tagKey(naechste.beginn, zeitzone) === heuteKey
  const offen = stunden.filter(istOffen).reverse()

  const h = stundeDerSchule(zeitzone)
  const gruss = h < 11 ? T('n_gruss_morgen') : h < 17 ? T('n_gruss_tag') : T('n_gruss_abend')
  const vorname = (profil?.voller_name ?? '').split(' ')[0]

  function heroUeber() {
    if (laeuft) return T('n_laeuft_gerade')
    const min = Math.round((new Date(naechste.beginn) - jetzt) / 60000)
    if (istHeute && min <= 90) return T('nl_in_minuten').replace('{n}', Math.max(min, 1))
    return T('n_naechster_termin')
  }

  function status(s) {
    if (s.status === 'stattgefunden') return [T('nl_erledigt'), 'var(--success)']
    if (s.status === 'abgesagt') return [T('n_faellt_aus'), 'var(--danger)']
    if (istOffen(s)) return [T('nl_offen'), 'var(--primary)']
    if (naechste?.id === s.id) return [laeuft ? T('n_laeuft_gerade') : T('nl_gleich'), 'var(--primary)']
    return [T('nl_spaeter'), 'var(--text-2)']
  }

  const aufgaben = []
  offen.slice(0, 3).forEach(s => aufgaben.push(
    <Zeile key={'o' + s.id} icon={ClipboardCheck} titel={T('nl_anwesenheit_nachtragen')}
      untertitel={`${s.unterricht?.name} · ${tagLabel(s.beginn, zeitzone, lang, T)}`} to={`/lehrer/stunde/${s.id}`} />,
  ))
  if (offen.length > 3) aufgaben.push(
    <Zeile key="o-mehr" icon={ClipboardCheck} titel={T('nl_weitere_offen').replace('{n}', offen.length - 3)} to="/lehrer/kurse" />,
  )
  if (vorschlaege > 0) aufgaben.push(
    <Zeile key="v" icon={Music} iconFarbe="var(--success)" titel={T('nl_vorschlaege_pruefen').replace('{n}', vorschlaege)} to="/lehrer/repertoire?tab=vorschlaege" />,
  )
  if (ungelesen.length > 0) aufgaben.push(
    <Zeile key="n" icon={MessageCircle} iconFarbe="#2563EB" titel={T('nl_neue_nachrichten').replace('{n}', ungelesen.length)}
      untertitel={ungelesen[0]?.sender?.voller_name} punkt to="/lehrer/nachrichten" />,
  )

  const heroKnopf = { flex: '1 1 140px', height: 52, borderRadius: 14, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }

  return (
    <Seite
      ueber={datumLang(zeitzone, lang)}
      titel={vorname ? `${gruss}, ${vorname}` : gruss}
      rechts={
        <Link to="/lehrer/ich" aria-label={T('n_tab_ich')} style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, textDecoration: 'none', overflow: 'hidden' }}>
          {profil?.avatar_url ? <img src={profil.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (vorname[0] ?? '?').toUpperCase()}
        </Link>
      }
    >
      <div style={{ marginTop: 16 }}>
        {isLoading ? <Laden hoehe={240} /> : naechste ? (
          <section aria-label={T('n_naechster_termin')} style={{ margin: '0 20px', padding: 22, borderRadius: 24, background: 'var(--n-hero)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--n-hero-sub)' }}>{heroUeber()}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{naechste.unterricht?.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17 }}>
              <Clock aria-hidden="true" size={20} />
              {!istHeute && `${tagLabel(naechste.beginn, zeitzone, lang, T)} · `}{uhrzeit(naechste.beginn, zeitzone, lang)} – {uhrzeit(naechste.ende, zeitzone, lang)}
            </div>
            {naechste.raum && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17 }}>
                <MapPin aria-hidden="true" size={20} />{naechste.raum}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17 }}>
              <Users aria-hidden="true" size={20} />
              {T('nl_teilnehmer_n').replace('{n}', naechste.teilnehmer)}
              {naechste.entschuldigt > 0 && ` · ${T('nl_entschuldigt_n').replace('{n}', naechste.entschuldigt)}`}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {istHeute && (
                <Link to={`/lehrer/kurse/${naechste.unterricht_id}/unterrichtsmodus`} style={{ ...heroKnopf, background: '#FFFFFF', color: 'var(--n-hero-btn-fg)', fontWeight: 700 }}>
                  <Play aria-hidden="true" size={18} fill="currentColor" />{T('nl_unterricht_starten')}
                </Link>
              )}
              <Link to={`/lehrer/stunde/${naechste.id}`} style={{ ...heroKnopf, background: 'var(--n-hero-2)', color: '#FFFFFF', fontWeight: 600 }}>{T('nl_anwesenheit')}</Link>
            </div>
          </section>
        ) : (
          <Leer text={T('nl_keine_stunden')} />
        )}
      </div>

      {heute.length > 0 && (
        <Abschnitt titel={T('n_heute')}>
          <Gruppe>
            {heute.map((s, i) => {
              const [text, farbe] = status(s)
              return (
                <div key={s.id}>
                  {i > 0 && <Trenner />}
                  <Zeile bild={<span style={{ width: 56, flexShrink: 0, fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{uhrzeit(s.beginn, zeitzone, lang)}</span>}
                    titel={s.unterricht?.name} untertitel={[T('nl_teilnehmer_n').replace('{n}', s.teilnehmer), s.raum].filter(Boolean).join(' · ')}
                    wert={text} wertFarbe={farbe}
                    to={s.status === 'abgesagt' ? `/lehrer/kurse/${s.unterricht_id}` : `/lehrer/stunde/${s.id}`} />
                </div>
              )
            })}
          </Gruppe>
        </Abschnitt>
      )}

      <Abschnitt titel={T('nl_zu_erledigen')}>
        {isLoading ? <Laden /> : aufgaben.length === 0 ? <Leer text={T('nl_alles_erledigt')} /> : (
          <Gruppe>
            {aufgaben.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}
          </Gruppe>
        )}
      </Abschnitt>
    </Seite>
  )
}
