import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, MessageCircle, UserPlus, Receipt, ClipboardCheck, Music, Inbox, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { useOffeneVorschlaege } from '../../hooks/useOffeneVorschlaege'
import { useUngelesen } from '../daten'
import { uhrzeit, tagKey, datumLang, stundeDerSchule, schulZeitZuIso, wochentagKurz, tagDesMonats } from '../zeit'

const TAG = 86400000

// Kennzahlen, offene Aufgaben und der heutige Tag der aktiven Schule
function useAdminStart() {
  const { schule, rolle, zeitzone } = useApp()
  return useQuery({
    queryKey: ['na-start', schule?.id, rolle],
    enabled: !!schule?.id,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const heute = tagKey(new Date().toISOString(), zeitzone)
      const morgen = new Date(Date.parse(heute + 'T00:00:00Z') + TAG).toISOString().slice(0, 10)
      const jetzt = new Date().toISOString()
      const anzahl = q => q.then(r => r.count ?? 0)
      const [stats, interessenten, rechnungen, offen, stunden, demos] = await Promise.all([
        supabase.rpc('dashboard_stats', { p_schule_id: schule.id }),
        anzahl(supabase.from('interessenten').select('id', { count: 'exact', head: true }).eq('schule_id', schule.id).eq('status', 'interessent')),
        anzahl(supabase.from('rechnungen').select('id', { count: 'exact', head: true }).eq('schule_id', schule.id)
          .is('bezahlt_am', null).is('storniert_am', null).lt('faellig_am', heute)),
        anzahl(supabase.from('stunden').select('id, unterricht!inner(schule_id)', { count: 'exact', head: true })
          .eq('unterricht.schule_id', schule.id).eq('status', 'geplant')
          .lt('ende', jetzt).gte('ende', new Date(Date.now() - 30 * TAG).toISOString())),
        supabase.from('stunden')
          .select('id, beginn, ende, status, raeume(name), unterricht!inner(id, name, schule_id, raeume(name), unterricht_lehrer(rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
          .eq('unterricht.schule_id', schule.id)
          .gte('beginn', schulZeitZuIso(heute, '00:00', zeitzone)).lt('beginn', schulZeitZuIso(morgen, '00:00', zeitzone))
          .order('beginn'),
        rolle === 'superadmin'
          ? anzahl(supabase.from('demo_anfragen').select('id', { count: 'exact', head: true }).eq('status', 'ausstehend'))
          : Promise.resolve(0),
      ])
      return { stats: stats.data ?? {}, interessenten, rechnungen, offen, stunden: stunden.data ?? [], demos }
    },
  })
}

function Kennzahl({ label, wert, unter, to }) {
  return (
    <Link to={to} style={{ padding: '16px 18px', borderRadius: 20, background: 'var(--n-fill)', color: 'var(--text)', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{wert}</span>
      {unter && <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{unter}</span>}
    </Link>
  )
}

function Ueberschrift({ children }) {
  return <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{children}</h2>
}

const schnellKnopf = { minHeight: 44, padding: '0 16px', borderRadius: 22, fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }

export default function AdminStart() {
  const { profil, rolle, T, lang, zeitzone } = useApp()
  const { data, isLoading } = useAdminStart()
  const { data: vorschlaege = 0 } = useOffeneVorschlaege()
  const { data: ungelesen = [] } = useUngelesen()

  const h = stundeDerSchule(zeitzone)
  const gruss = h < 11 ? T('n_gruss_morgen') : h < 17 ? T('n_gruss_tag') : T('n_gruss_abend')
  const vorname = (profil?.voller_name ?? '').split(' ')[0]
  const stats = data?.stats ?? {}
  const jetzt = Date.now()

  const aufgaben = []
  if (data?.demos > 0) aufgaben.push(
    <Zeile key="d" icon={Inbox} titel={T('na_demo_n').replace('{n}', data.demos)} untertitel={T('na_demo_hinweis')} to="/superadmin/demos" />,
  )
  if (data?.interessenten > 0) aufgaben.push(
    <Zeile key="i" icon={UserPlus} titel={T('na_interessenten_n').replace('{n}', data.interessenten)} untertitel={T('na_interessenten_hinweis')} to="/admin/interessenten" />,
  )
  if (data?.rechnungen > 0) aufgaben.push(
    <Zeile key="r" icon={Receipt} iconFarbe="var(--danger)" titel={T('na_rechnungen_n').replace('{n}', data.rechnungen)} untertitel={T('na_rechnungen_hinweis')} to="/admin/rechnungen" />,
  )
  if (data?.offen > 0) aufgaben.push(
    <Zeile key="o" icon={ClipboardCheck} iconFarbe="#2563EB" titel={T('na_offen_n').replace('{n}', data.offen)} untertitel={T('na_offen_hinweis')} to="/admin/stundenplan" />,
  )
  if (vorschlaege > 0) aufgaben.push(
    <Zeile key="v" icon={Music} iconFarbe="var(--success)" titel={T('nl_vorschlaege_pruefen').replace('{n}', vorschlaege)} to="/admin/repertoire?tab=vorschlaege" />,
  )
  if (ungelesen.length > 0) aufgaben.push(
    <Zeile key="n" icon={MessageCircle} iconFarbe="#2563EB" titel={T('nl_neue_nachrichten').replace('{n}', ungelesen.length)}
      untertitel={ungelesen[0]?.sender?.voller_name} punkt to="/admin/nachrichten" />,
  )

  function status(s) {
    if (s.status === 'abgesagt') return [T('n_faellt_aus'), 'var(--danger)']
    if (s.status === 'stattgefunden') return [T('nl_erledigt'), 'var(--success)']
    if (new Date(s.beginn) <= jetzt && new Date(s.ende) > jetzt) return [T('n_laeuft_gerade'), 'var(--primary)']
    if (new Date(s.ende) <= jetzt) return [T('nl_offen'), 'var(--primary)']
    return [null, null]
  }

  const lehrkraft = s => {
    const l = s.unterricht?.unterricht_lehrer ?? []
    return (l.find(x => x.rolle === 'hauptlehrer') ?? l[0])?.profiles?.voller_name
  }

  const events = (stats.naechste_events ?? []).slice(0, 3)

  return (
    <Seite breit ueber={datumLang(zeitzone, lang)} titel={vorname ? `${gruss}, ${vorname}` : gruss}>
      <div style={{ margin: '14px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/admin/mitglieder" style={{ ...schnellKnopf, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', fontWeight: 700 }}><Plus aria-hidden="true" size={18} strokeWidth={2.2} />{T('na_mitglied')}</Link>
        <Link to="/admin/kurse" style={{ ...schnellKnopf, background: 'var(--n-fill)', color: 'var(--text)', fontWeight: 600 }}><Plus aria-hidden="true" size={18} strokeWidth={2.2} />{T('na_kurs')}</Link>
        <Link to="/admin/nachrichten" style={{ ...schnellKnopf, background: 'var(--n-fill)', color: 'var(--text)', fontWeight: 600 }}><MessageCircle aria-hidden="true" size={18} />{T('na_nachricht_an_alle')}</Link>
        {rolle === 'superadmin' && (
          <Link to="/superadmin" style={{ ...schnellKnopf, background: 'var(--n-fill)', color: 'var(--text)', fontWeight: 600 }}><Building2 aria-hidden="true" size={18} />{T('all_schools')}</Link>
        )}
      </div>

      <div style={{ margin: '22px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {isLoading ? [0, 1, 2, 3].map(i => <div key={i} aria-busy="true" style={{ height: 104, borderRadius: 20, background: 'var(--n-fill)', animation: 'nPuls 1.4s ease-in-out infinite' }} />) : <>
          <Kennzahl label={T('na_schueler')} wert={stats.schueler_gesamt ?? 0} to="/admin/mitglieder" />
          <Kennzahl label={T('na_lehrkraefte')} wert={stats.lehrer_gesamt ?? 0} to="/admin/mitglieder" />
          <Kennzahl label={T('na_aktive_kurse')} wert={stats.unterricht_aktiv ?? 0} unter={T('na_stunden_woche').replace('{n}', stats.stunden_woche ?? 0)} to="/admin/kurse" />
          <Kennzahl label={T('na_anwesenheit')} wert={stats.anwesenheit_quote != null ? `${Math.round(stats.anwesenheit_quote)} %` : '–'} unter={T('na_letzte_30_tage')} to="/admin/stundenplan" />
        </>}
      </div>

      <div style={{ margin: '32px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', rowGap: 32 }}>
        <div>
          <section>
            <div style={{ padding: '0 20px' }}><Ueberschrift>{T('nl_zu_erledigen')}</Ueberschrift></div>
            {isLoading ? <Laden /> : aufgaben.length === 0 ? <Leer text={T('nl_alles_erledigt')} /> : (
              <Gruppe>{aufgaben.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}</Gruppe>
            )}
          </section>

          {events.length > 0 && (
            <section style={{ marginTop: 32 }}>
              <div style={{ padding: '0 20px' }}><Ueberschrift>{T('na_naechste_events')}</Ueberschrift></div>
              <Gruppe>
                {events.map((e, i) => (
                  <div key={e.id}>
                    {i > 0 && <Trenner />}
                    <Zeile to="/admin/events" titel={e.titel} untertitel={[T(`n_evt_${e.typ}`), uhrzeit(e.beginn, zeitzone, lang)].join(' · ')}
                      bild={
                        <span aria-hidden="true" style={{ width: 52, flexShrink: 0, textAlign: 'center', borderRadius: 12, background: 'var(--bg)', padding: '5px 0' }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: '#2563EB' }}>{wochentagKurz(e.beginn, zeitzone, lang)}</span>
                          <span style={{ display: 'block', fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{tagDesMonats(e.beginn, zeitzone)}</span>
                        </span>
                      } />
                  </div>
                ))}
              </Gruppe>
            </section>
          )}
        </div>

        <section>
          <div style={{ padding: '0 20px' }}><Ueberschrift>{T('na_heute_in_der_schule')}</Ueberschrift></div>
          {isLoading ? <Laden hoehe={240} /> : !data?.stunden.length ? <Leer text={T('na_heute_keine_stunden')} /> : (
            <Gruppe>
              {data.stunden.map((s, i) => {
                const [text, farbe] = status(s)
                return (
                  <div key={s.id}>
                    {i > 0 && <Trenner />}
                    <Zeile to={`/admin/kurse/${s.unterricht.id}`} titel={s.unterricht.name}
                      untertitel={[lehrkraft(s), s.raeume?.name ?? s.unterricht.raeume?.name].filter(Boolean).join(' · ')}
                      wert={text} wertFarbe={farbe}
                      bild={<span style={{ width: 52, flexShrink: 0, fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{uhrzeit(s.beginn, zeitzone, lang)}</span>} />
                  </div>
                )
              })}
            </Gruppe>
          )}
        </section>
      </div>
    </Seite>
  )
}
