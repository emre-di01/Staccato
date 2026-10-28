import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Phone, MapPin, Cake, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Suchfeld, Leer, Laden, Blatt, Knopf } from '../../ui'

// Alle Schüler aus meinen Kursen, mit Anwesenheitsquote je Kurs
function useMeineSchueler() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['nl-schueler', profil?.id, schule?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('unterricht_lehrer')
        .select('unterricht(id, name, unterricht_schueler(schueler_id, status, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, telefon, adresse, avatar_url)))')
        .eq('lehrer_id', profil.id)
      if (error) throw error
      const map = new Map()
      for (const { unterricht: k } of data ?? []) {
        if (!k) continue
        for (const us of k.unterricht_schueler ?? []) {
          if (us.status !== 'aktiv' || !us.profiles) continue
          const e = map.get(us.profiles.id) ?? { ...us.profiles, kurse: [] }
          e.kurse.push({ id: k.id, name: k.name })
          map.set(us.profiles.id, e)
        }
      }
      const schueler = [...map.values()].sort((a, b) => a.voller_name.localeCompare(b.voller_name))
      const kursIds = [...new Set(schueler.flatMap(s => s.kurse.map(k => k.id)))]
      if (!kursIds.length) return schueler
      const [{ data: st }, { data: anw }] = await Promise.all([
        supabase.from('stunden').select('id, unterricht_id').in('unterricht_id', kursIds).eq('status', 'stattgefunden'),
        supabase.from('anwesenheit').select('schueler_id, stunde_id, status').in('schueler_id', schueler.map(s => s.id)),
      ])
      const kursVon = Object.fromEntries((st ?? []).map(s => [s.id, s.unterricht_id]))
      return schueler.map(s => {
        const eigene = (anw ?? []).filter(a => a.schueler_id === s.id && kursVon[a.stunde_id])
        const quote = arr => arr.length ? Math.round(100 * arr.filter(a => a.status === 'anwesend' || a.status === 'zu_spaet').length / arr.length) : null
        return {
          ...s,
          quote: quote(eigene),
          kurse: s.kurse.map(k => ({ ...k, quote: quote(eigene.filter(a => kursVon[a.stunde_id] === k.id)) })),
        }
      })
    },
  })
}

export default function LehrerSchueler() {
  const { T } = useApp()
  const { data: schueler = [], isLoading } = useMeineSchueler()
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState(null)

  const q = suche.trim().toLowerCase()
  const liste = schueler.filter(s => !q || s.voller_name.toLowerCase().includes(q) || s.kurse.some(k => k.name.toLowerCase().includes(q)))

  return (
    <Seite titel={T('my_students')} zurueck={{ to: '/lehrer/kurse', label: T('nl_tab_kurse') }}>
      <div style={{ marginTop: 16 }}>
        <Suchfeld wert={suche} onChange={setSuche} label={T('nl_schueler_suchen')} placeholder={T('nl_name_oder_kurs')} />
      </div>
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden hoehe={300} /> : liste.length === 0 ? <Leer text={q ? T('nl_niemand_gefunden') : T('nl_keine_teilnehmer')} /> : (
          <Gruppe>
            {liste.map((s, i) => (
              <div key={s.id}>
                {i > 0 && <Trenner />}
                <Zeile bild={<Avatar s={s} />} titel={s.voller_name} untertitel={s.kurse.map(k => k.name).join(' · ')}
                  wert={s.quote == null ? null : `${s.quote} %`} wertFarbe={s.quote < 75 ? 'var(--primary)' : 'var(--success)'}
                  onClick={() => setOffen(s)} />
              </div>
            ))}
          </Gruppe>
        )}
      </div>
      {offen && <SchuelerBlatt s={offen} onClose={() => setOffen(null)} />}
    </Seite>
  )
}

function Avatar({ s, groesse = 40 }) {
  return (
    <span aria-hidden="true" style={{ width: groesse, height: groesse, flexShrink: 0, borderRadius: groesse / 2, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: groesse * 0.38, fontWeight: 700, overflow: 'hidden' }}>
      {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.voller_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
    </span>
  )
}

function SchuelerBlatt({ s, onClose }) {
  const { T, lang } = useApp()
  const navigate = useNavigate()
  const geburtstag = s.geburtsdatum && new Intl.DateTimeFormat({ de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }[lang] ?? 'de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(s.geburtsdatum))
  const kontakt = [
    s.telefon && <Zeile key="tel" icon={Phone} titel={s.telefon} href={`tel:${s.telefon}`} chevron={false} />,
    s.adresse && <Zeile key="adr" icon={MapPin} titel={s.adresse} />,
    geburtstag && <Zeile key="geb" icon={Cake} titel={geburtstag} />,
  ].filter(Boolean)

  return (
    <Blatt titel={s.voller_name} onClose={onClose}>
      <div style={{ margin: '0 -20px' }}>
        {kontakt.length > 0 && (
          <Gruppe>{kontakt.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}</Gruppe>
        )}
        <Abschnitt titel={T('nl_tab_kurse')} style={{ marginTop: kontakt.length ? 24 : 0 }}>
          <Gruppe>
            {s.kurse.map((k, i) => (
              <div key={k.id}>
                {i > 0 && <Trenner />}
                <Zeile titel={k.name} untertitel={k.quote == null ? T('nl_noch_keine_anwesenheit') : T('nl_anwesenheit_quote')}
                  wert={k.quote == null ? null : `${k.quote} %`} wertFarbe={k.quote < 75 ? 'var(--primary)' : 'var(--success)'}
                  onClick={() => navigate(`/lehrer/kurse/${k.id}`)} />
              </div>
            ))}
          </Gruppe>
        </Abschnitt>
        <div style={{ margin: '24px 20px 0' }}>
          <Knopf voll variante="sekundaer" icon={MessageCircle} onClick={() => navigate(`/lehrer/nachrichten?neu=direkt&an=${s.id}`)}>{T('nl_nachricht_schreiben')}</Knopf>
        </div>
      </div>
    </Blatt>
  )
}
