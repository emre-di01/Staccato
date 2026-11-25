// Bankdaten liegen getrennt vom Profil (profil_bankdaten) und werden nur über bankdaten_setzen() geschrieben
const FELDER = ['zahlungsweise', 'zahlungsrhythmus', 'mitgliedsbeitrag', 'kontoinhaber', 'iban', 'bic']

// Formularwerte in Profil- und Bankfelder aufteilen
export function aufteilen(werte) {
  const bank = {}, profil = {}
  for (const [k, v] of Object.entries(werte)) (FELDER.includes(k) ? bank : profil)[k] = v
  return { profil, bank }
}

// Profil und Bankdaten speichern; liefert den ersten Fehler oder null
export async function profilSpeichern(supabase, id, werte) {
  const { profil, bank } = aufteilen(werte)
  if (Object.keys(profil).length) {
    const { error } = await supabase.from('profiles').update(profil).eq('id', id)
    if (error) return error
  }
  if (Object.keys(bank).length) {
    const { error } = await supabase.rpc('bankdaten_setzen', { p_profil: id, p_daten: bank })
    if (error) return error
  }
  return null
}
