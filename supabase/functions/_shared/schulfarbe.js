// Schulfarbe als Akzent im neuen Design.
// Aus einer beliebigen Farbe werden die Akzent-Tokens für hell und dunkel abgeleitet –
// Helligkeit wird so lange verschoben, bis der Kontrast für Text reicht (WCAG AA, 4.5:1).

// Alter Spalten-Standard (fast schwarz) gilt als „keine Schulfarbe“ → Orange bleibt
const ALTER_STANDARD = '#1a1a2e'

// Vorschläge für die Auswahl unter Verwaltung → Schule (null = Standard-Orange)
export const SCHULFARBEN = [null, '#DC2626', '#DB2777', '#9333EA', '#4F46E5', '#2563EB', '#0891B2', '#0D9488', '#16A34A', '#65A30D', '#CA8A04', '#78716C']

export function gueltigeSchulfarbe(hex) {
  if (typeof hex !== 'string') return null
  const h = hex.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(h) || h === ALTER_STANDARD) return null
  return h
}

function hexZuHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslZuRgb(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255))
}

const hex = rgb => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()

function luminanz([r, g, b]) {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function kontrast(a, b) {
  const [x, y] = [luminanz(a), luminanz(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const WEISS = [255, 255, 255], DUNKEL = [28, 28, 30]

// Helligkeit schrittweise verschieben (richtung -1 = dunkler, +1 = heller), bis Kontrast zu `gegen` reicht
function mitKontrast(h, s, l, gegen, richtung, ziel = 4.5) {
  let rgb = hslZuRgb(h, s, l)
  while (kontrast(rgb, gegen) < ziel && l > 0 && l < 100) {
    l += richtung * 2
    rgb = hslZuRgb(h, s, Math.max(0, Math.min(100, l)))
  }
  return { rgb, l }
}

// Token-Satz für hell oder dunkel; null, wenn keine (gültige) Schulfarbe gesetzt ist
export function schulfarbenTokens(farbe, dunkel) {
  const f = gueltigeSchulfarbe(farbe)
  if (!f) return null
  const [h, s0, l0] = hexZuHsl(f)
  const s = Math.min(s0, 85)

  // Heldenfläche + heller Akzent: weiße Schrift muss lesbar sein
  const hero = mitKontrast(h, s, Math.min(l0, 50), WEISS, -1)
  const hero2 = hex(hslZuRgb(h, s, Math.max(0, hero.l - 8)))
  const heroSub = mitKontrast(h, Math.min(s, 70), 93, hslZuRgb(h, s, hero.l), +1).rgb
  const tintHell = hslZuRgb(h, Math.min(s, 70), 92)
  const tintFgHell = mitKontrast(h, s, Math.min(hero.l, 35), tintHell, -1).rgb
  const [r, g, b] = hslZuRgb(h, s, 55)

  const gemeinsam = {
    '--n-hero': hex(hero.rgb), '--n-hero-2': hero2, '--n-hero-sub': hex(heroSub), '--n-hero-btn-fg': hex(tintFgHell),
  }
  if (!dunkel) {
    return {
      ...gemeinsam,
      '--primary': hex(hero.rgb), '--primary-fg': '#FFFFFF', '--accent': hex(hero.rgb), '--accent-fg': '#FFFFFF',
      '--n-tint': hex(tintHell), '--n-tint-fg': hex(tintFgHell),
      '--n-glas-b1': `rgba(${r},${g},${b},0.42)`,
    }
  }
  // Dunkel: heller Akzent auf fast schwarzen Flächen, dunkle Schrift auf Akzentknöpfen
  const prim = mitKontrast(h, s, Math.max(l0, 60), DUNKEL, +1)
  const tintDunkel = hslZuRgb(h, Math.min(s, 45), 16)
  const tintFgDunkel = mitKontrast(h, s, 75, tintDunkel, +1).rgb
  const primFg = hex(hslZuRgb(h, Math.min(s, 60), 6))
  return {
    ...gemeinsam,
    '--primary': hex(prim.rgb), '--primary-fg': primFg, '--accent': hex(prim.rgb), '--accent-fg': primFg,
    '--n-tint': hex(tintDunkel), '--n-tint-fg': hex(tintFgDunkel),
    '--n-glas-b1': `rgba(${r},${g},${b},0.34)`,
  }
}
