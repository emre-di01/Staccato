import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Dateien gelöschter Konten entfernen. Welche das sind, entscheidet die Datenbank (konto_dateien_offen).
export async function kontoDateienLoeschen(supabase: SupabaseClient): Promise<Response> {
  const { data, error } = await supabase.rpc('konto_dateien_offen')
  if (error) return new Response(`Fehler: ${error.message}`, { status: 500 })

  const jeBucket: Record<string, string[]> = {}
  for (const d of data as { konto: string; bucket: string; pfad: string }[]) {
    // Zweite Sicherung: nie etwas außerhalb des Kontoordners
    if (/^[0-9a-f-]{36}$/.test(d.konto) && d.pfad.startsWith(`${d.konto}/`)) (jeBucket[d.bucket] ??= []).push(d.pfad)
  }
  let geloescht = 0, fehler = 0
  for (const [bucket, pfade] of Object.entries(jeBucket)) {
    for (let i = 0; i < pfade.length; i += 100) {
      const { data: weg, error: e } = await supabase.storage.from(bucket).remove(pfade.slice(i, i + 100))
      if (e) { fehler++; console.error('Konto-Dateien:', bucket, e.message) } else geloescht += weg?.length ?? 0
    }
  }
  const { data: offen, error: e2 } = await supabase.rpc('konto_dateien_fertig')
  if (e2) return new Response(`Fehler: ${e2.message}`, { status: 500 })
  console.log(`Konto-Dateien: ${geloescht} gelöscht, ${offen} Konten offen`)
  return new Response(`ok – ${geloescht} Dateien gelöscht, ${offen} Konten offen`, { status: fehler ? 500 : 200 })
}
