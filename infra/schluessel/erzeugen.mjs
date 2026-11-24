// Gibt frische STACCATO_*-Schlüssel als env-Zeilen aus (anon/service_role ES256-signiert; REST nimmt nur die an).
// Vorher: echo '[]' > supabase/signing_keys.json && supabase gen signing-key --yes
// Aufruf: node infra/schluessel/erzeugen.mjs supabase/signing_keys.json
import { randomBytes, createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const k = JSON.parse(readFileSync(process.argv[2], 'utf8'))[0]
const key = createPrivateKey({ key: k, format: 'jwk' })
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const iat = Math.floor(Date.now() / 1000)
const jwt = role => {
  const t = `${b64({ alg: 'ES256', kid: k.kid, typ: 'JWT' })}.${b64({ iss: 'staccato', role, iat, exp: iat + 10 * 365 * 86400 })}`
  return `${t}.${sign('sha256', Buffer.from(t), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}
console.log([
  `STACCATO_JWT_SECRET=${randomBytes(40).toString('hex')}`,
  `STACCATO_ANON_KEY=${jwt('anon')}`,
  `STACCATO_SERVICE_ROLE_KEY=${jwt('service_role')}`,
  `STACCATO_PUBLISHABLE_KEY=sb_publishable_${randomBytes(24).toString('base64url')}`,
  `STACCATO_SECRET_KEY=sb_secret_${randomBytes(24).toString('base64url')}`,
].join('\n'))
