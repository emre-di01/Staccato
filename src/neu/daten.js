// Datenzugriff der neuen Schüler-Oberfläche (react-query). Gemeinsame Query-Keys mit
// Präfix 'n-', damit Aktionen (Absagen, Zusagen) gezielt neu laden können.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const TAG = 24 * 60 * 60 * 1000

export function useNeuLaden() {
  const qc = useQueryClient()
  return (...keys) => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
}

// Aktive Kurse des Schülers
export function useMeineKurse() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['n-kurse', profil?.id, schule?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('unterricht_schueler')
        .select('unterricht(id, name, typ, raeume(name))')
        .eq('schueler_id', profil.id).eq('status', 'aktiv')
      if (error) throw error
      return (data ?? []).map(d => d.unterricht).filter(Boolean)
    },
  })
}

// Stunden der eigenen Kurse (vor `zurueck` Tagen bis +tage), inkl. eigener Anwesenheit.
// Mit `kursId` nur die Stunden dieses Kurses.
export function useMeineStunden(tage = 60, { kursId, zurueck = 1 } = {}) {
  const { profil, schule } = useApp()
  const { data: kurse } = useMeineKurse()
  return useQuery({
    queryKey: ['n-stunden', profil?.id, schule?.id, tage, kurse?.length, kursId ?? null, zurueck],
    enabled: !!profil?.id && !!kurse,
    queryFn: async () => {
      if (!kurse.length) return []
      const jetzt = Date.now()
      const { data, error } = await supabase.from('stunden')
        .select('id, beginn, ende, status, hausaufgaben, unterricht_id, unterricht(name, typ, raeume(name)), raeume(name), anwesenheit(status, schueler_id)')
        .in('unterricht_id', kursId ? [kursId] : kurse.map(k => k.id))
        .gte('ende', new Date(jetzt - zurueck * TAG).toISOString())
        .lte('beginn', new Date(jetzt + tage * TAG).toISOString())
        .order('beginn')
      if (error) throw error
      return (data ?? []).map(st => ({
        ...st,
        meine: (st.anwesenheit ?? []).find(a => a.schueler_id === profil.id) ?? null,
        raum: st.raeume?.name ?? st.unterricht?.raeume?.name ?? null,
      }))
    },
  })
}

// Sich für eine Stunde entschuldigen bzw. die Entschuldigung zurücknehmen
export function useAbsage() {
  const { profil, toast } = useApp()
  const neuLaden = useNeuLaden()
  const [sendet, setSendet] = useState(null)
  async function umschalten(stunde) {
    setSendet(stunde.id)
    const { error } = stunde.meine
      ? await supabase.from('anwesenheit').delete().eq('stunde_id', stunde.id).eq('schueler_id', profil.id)
      : await supabase.from('anwesenheit').insert({ stunde_id: stunde.id, schueler_id: profil.id, status: 'entschuldigt' })
    setSendet(null)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('n-stunden')
  }
  return { umschalten, sendet }
}

// Letzte Hausaufgabe (jüngste vergangene Stunde mit Hausaufgaben)
export function useLetzteHausaufgabe() {
  const { profil, schule } = useApp()
  const { data: kurse } = useMeineKurse()
  return useQuery({
    queryKey: ['n-hausaufgabe', profil?.id, schule?.id, kurse?.length],
    enabled: !!profil?.id && !!kurse,
    queryFn: async () => {
      if (!kurse.length) return null
      const { data } = await supabase.from('stunden')
        .select('id, beginn, hausaufgaben, unterricht(name)')
        .in('unterricht_id', kurse.map(k => k.id))
        .lte('beginn', new Date().toISOString())
        .not('hausaufgaben', 'is', null).neq('hausaufgaben', '')
        .order('beginn', { ascending: false }).limit(1)
      return data?.[0] ?? null
    },
  })
}

// Veranstaltungen der Schule (heute bis +180 Tage) mit eigener Zusage
export function useMeineEvents() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['n-events', profil?.id, schule?.id],
    enabled: !!profil?.id && !!schule?.id,
    queryFn: async () => {
      const heute = new Date(); heute.setHours(0, 0, 0, 0)
      const { data, error } = await supabase.from('events')
        .select('id, titel, typ, beginn, ende, ort, beschreibung, oeffentlich, erstellt_von, raeume(name), event_teilnehmer(zusage, profil_id), event_stuecke(stueck_id)')
        .eq('schule_id', schule.id)
        .gte('beginn', heute.toISOString())
        .lte('beginn', new Date(Date.now() + 180 * TAG).toISOString())
        .order('beginn')
      if (error) throw error
      return (data ?? []).map(ev => {
        const ich = (ev.event_teilnehmer ?? []).find(t => t.profil_id === profil.id)
        return { ...ev, eingeladen: !!ich, zusage: ich?.zusage ?? null }
      })
    },
  })
}

// Stücke aus den eigenen Kursen: [{ stueck, kurse: [{id, name, status}] }]
export function useMeineLieder() {
  const { profil, schule } = useApp()
  const { data: kurse } = useMeineKurse()
  return useQuery({
    queryKey: ['n-lieder', profil?.id, schule?.id, kurse?.length],
    enabled: !!profil?.id && !!kurse,
    queryFn: async () => {
      if (!kurse.length) return []
      const { data: us, error } = await supabase.from('unterricht_stuecke')
        .select('unterricht_id, status, reihenfolge, stuecke(id, titel, komponist, liedtext, notizen, stueck_dateien(typ))')
        .in('unterricht_id', kurse.map(k => k.id))
      if (error) throw error
      const kursName = Object.fromEntries(kurse.map(k => [k.id, k.name]))
      const map = new Map()
      for (const u of us ?? []) {
        if (!u.stuecke) continue
        const e = map.get(u.stuecke.id) ?? { stueck: u.stuecke, kurse: [] }
        e.kurse.push({ id: u.unterricht_id, name: kursName[u.unterricht_id], status: u.status, reihenfolge: u.reihenfolge ?? 0 })
        map.set(u.stuecke.id, e)
      }
      return [...map.values()].sort((a, b) => a.stueck.titel.localeCompare(b.stueck.titel))
    },
  })
}

// Eigene Lied- und Textvorschläge
export function useMeineVorschlaege() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['lied-vorschlaege', 'n-meine', profil?.id, schule?.id],
    enabled: !!profil?.id && !!schule?.id,
    queryFn: async () => {
      const { data } = await supabase.from('lied_vorschlaege')
        .select('id, art, titel, komponist, status, antwort, stueck_id, ziel_stueck_id, entschieden_am, erstellt_am')
        .eq('vorgeschlagen_von', profil.id).eq('schule_id', schule.id)
        .order('erstellt_am', { ascending: false })
      return data ?? []
    },
  })
}

// Ungelesene Nachrichten (gleiche Logik wie die alte Seitenleiste)
export function useUngelesen() {
  const { profil } = useApp()
  return useQuery({
    queryKey: ['n-ungelesen', profil?.id],
    enabled: !!profil?.id,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    queryFn: async () => {
      const [{ data }, { data: geloescht }] = await Promise.all([
        supabase.from('nachrichten')
          .select('id, betreff, gesendet_am, sender:profiles!nachrichten_gesendet_von_fkey(voller_name), gelesen:nachricht_gelesen(nachricht_id)')
          .neq('gesendet_von', profil.id)
          .order('gesendet_am', { ascending: false }).limit(20),
        supabase.from('nachricht_geloescht').select('nachricht_id').eq('user_id', profil.id),
      ])
      const weg = new Set((geloescht ?? []).map(r => r.nachricht_id))
      return (data ?? []).filter(n => !n.gelesen?.length && !weg.has(n.id))
    },
  })
}

// Inhalts-Hinweise für Listen: „Text · Akkorde · Noten · Audio“
export function liedInhalt(stueck, T) {
  const typen = new Set((stueck.stueck_dateien ?? []).map(d => d.typ))
  const teile = []
  if (stueck.liedtext) teile.push(T('piece_lyrics'))
  if (stueck.notizen || typen.has('akkorde')) teile.push(T('piece_chords'))
  if (typen.has('noten') || typen.has('musicxml')) teile.push(T('piece_notes_label'))
  if (typen.has('audio')) teile.push(T('piece_audio'))
  return teile.join(' · ')
}
