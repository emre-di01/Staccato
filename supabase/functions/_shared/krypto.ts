// Verschlüsselung der Zahlungsschlüssel (AES-256-GCM). Der Hauptschlüssel liegt nur in der Function-Umgebung
// (ZAHLUNG_SCHLUESSEL, 32 Byte base64), nie in Datenbank oder Backups. Die schule_id ist mit eingebunden,
// ein kopierter Eintrag funktioniert daher nicht für eine andere Schule.
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const vonB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function hauptschluessel() {
  const roh = vonB64(Deno.env.get('ZAHLUNG_SCHLUESSEL') ?? '')
  if (roh.length !== 32) throw new Error('ZAHLUNG_SCHLUESSEL fehlt oder ist ungültig')
  return await crypto.subtle.importKey('raw', roh, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
const bindung = (schuleId: string, zweck: string) => new TextEncoder().encode(`${schuleId}:${zweck}`)

export async function verschluesseln(text: string, schuleId: string, zweck: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bindung(schuleId, zweck) }, await hauptschluessel(), new TextEncoder().encode(text))
  return `v1:${b64(iv)}:${b64(new Uint8Array(d))}`
}

export async function entschluesseln(wert: string, schuleId: string, zweck: string): Promise<string> {
  const [v, iv, d] = wert.split(':')
  if (v !== 'v1') throw new Error('Unbekanntes Format')
  const t = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vonB64(iv), additionalData: bindung(schuleId, zweck) }, await hauptschluessel(), vonB64(d))
  return new TextDecoder().decode(t)
}

export async function hash(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${Deno.env.get('ZAHLUNG_SCHLUESSEL') ?? ''}:${text}`))
  return b64(new Uint8Array(d))
}
