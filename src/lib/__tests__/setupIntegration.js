import { readFileSync } from 'fs'
import { resolve } from 'path'

// Lädt .env.test manuell in process.env für Integration-Tests
try {
  const envPath = resolve(process.cwd(), '.env.test')
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch { /* .env.test nicht vorhanden — Integration-Tests werden übersprungen */ }
