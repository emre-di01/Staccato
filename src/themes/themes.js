// ─── Staccato Theme System ────────────────────────────────────
// 5 Themes × 2 Modi (light/dark)

export const THEMES = {
  klassik: {
    name: { de: 'Klassik', en: 'Classic', tr: 'Klasik' },
    icon: '🎹',
    light: {
      '--bg':           '#faf8f4',
      '--bg-2':         '#f0ede5',
      '--bg-3':         '#e8e3d8',
      '--surface':      '#ffffff',
      '--surface-2':    '#faf8f4',
      '--border':       '#d4c9b0',
      '--text':         '#1a1410',
      '--text-2':       '#5c4f3a',
      '--text-3':       '#6b5a3e',
      '--primary':      '#1a1410',
      '--primary-fg':   '#f5e6c0',
      '--accent':       '#c9a84c',
      '--accent-fg':    '#1a1410',
      '--danger':       '#c0392b',
      '--success':      '#27ae60',
      '--warning':      '#f39c12',
      '--shadow':       '0 2px 20px rgba(26,20,16,0.08)',
      '--shadow-lg':    '0 8px 40px rgba(26,20,16,0.14)',
      '--radius':       '10px',
      '--radius-lg':    '16px',
    },
    dark: {
      '--bg':           '#0f0d0a',
      '--bg-2':         '#1a1610',
      '--bg-3':         '#252018',
      '--surface':      '#1f1a13',
      '--surface-2':    '#2a2318',
      '--border':       '#3a3020',
      '--text':         '#f5e6c0',
      '--text-2':       '#c9b896',
      '--text-3':       '#a09070',
      '--primary':      '#c9a84c',
      '--primary-fg':   '#0f0d0a',
      '--accent':       '#e8c96a',
      '--accent-fg':    '#0f0d0a',
      '--danger':       '#e74c3c',
      '--success':      '#2ecc71',
      '--warning':      '#f1c40f',
      '--shadow':       '0 2px 20px rgba(0,0,0,0.4)',
      '--shadow-lg':    '0 8px 40px rgba(0,0,0,0.6)',
      '--radius':       '10px',
      '--radius-lg':    '16px',
    }
  },

  modern: {
    name: { de: 'Modern', en: 'Modern', tr: 'Modern' },
    icon: '🎸',
    light: {
      '--bg':           '#f0f7f7',
      '--bg-2':         '#e4f0f0',
      '--bg-3':         '#d4e8e8',
      '--surface':      '#ffffff',
      '--surface-2':    '#f4fafa',
      '--border':       '#b8d8d8',
      '--text':         '#0a2020',
      '--text-2':       '#2a5050',
      '--text-3':       '#3d6a6a',
      '--primary':      '#0d3d3d',
      '--primary-fg':   '#a8f0e0',
      '--accent':       '#00bfa5',
      '--accent-fg':    '#ffffff',
      '--danger':       '#e53935',
      '--success':      '#00897b',
      '--warning':      '#f57c00',
      '--shadow':       '0 2px 20px rgba(0,63,63,0.08)',
      '--shadow-lg':    '0 8px 40px rgba(0,63,63,0.14)',
      '--radius':       '12px',
      '--radius-lg':    '20px',
    },
    dark: {
      '--bg':           '#050f0f',
      '--bg-2':         '#0a1a1a',
      '--bg-3':         '#102525',
      '--surface':      '#0d2020',
      '--surface-2':    '#122828',
      '--border':       '#1a3838',
      '--text':         '#a8f0e0',
      '--text-2':       '#70c8b8',
      '--text-3':       '#5a9090',
      '--primary':      '#00bfa5',
      '--primary-fg':   '#050f0f',
      '--accent':       '#00e5cc',
      '--accent-fg':    '#050f0f',
      '--danger':       '#ef5350',
      '--success':      '#26a69a',
      '--warning':      '#ffa726',
      '--shadow':       '0 2px 20px rgba(0,0,0,0.5)',
      '--shadow-lg':    '0 8px 40px rgba(0,0,0,0.7)',
      '--radius':       '12px',
      '--radius-lg':    '20px',
    }
  },

  bold: {
    name: { de: 'Bold', en: 'Bold', tr: 'Cesur' },
    icon: '🎺',
    light: {
      '--bg':           '#faf5f5',
      '--bg-2':         '#f5eaea',
      '--bg-3':         '#edd8d8',
      '--surface':      '#ffffff',
      '--surface-2':    '#fdf8f8',
      '--border':       '#e0b8b8',
      '--text':         '#1a0808',
      '--text-2':       '#5a2020',
      '--text-3':       '#7a3535',
      '--primary':      '#1a0808',
      '--primary-fg':   '#ffcccc',
      '--accent':       '#c0392b',
      '--accent-fg':    '#ffffff',
      '--danger':       '#c0392b',
      '--success':      '#27ae60',
      '--warning':      '#e67e22',
      '--shadow':       '0 2px 20px rgba(192,57,43,0.1)',
      '--shadow-lg':    '0 8px 40px rgba(192,57,43,0.18)',
      '--radius':       '8px',
      '--radius-lg':    '14px',
    },
    dark: {
      '--bg':           '#0f0505',
      '--bg-2':         '#1a0808',
      '--bg-3':         '#251010',
      '--surface':      '#200a0a',
      '--surface-2':    '#2a1010',
      '--border':       '#3a1515',
      '--text':         '#ffcccc',
      '--text-2':       '#e89090',
      '--text-3':       '#b07070',
      '--primary':      '#e74c3c',
      '--primary-fg':   '#0f0505',
      '--accent':       '#ff6b6b',
      '--accent-fg':    '#0f0505',
      '--danger':       '#ff5252',
      '--success':      '#2ecc71',
      '--warning':      '#f39c12',
      '--shadow':       '0 2px 20px rgba(0,0,0,0.5)',
      '--shadow-lg':    '0 8px 40px rgba(0,0,0,0.7)',
      '--radius':       '8px',
      '--radius-lg':    '14px',
    }
  },

  kreativ: {
    name: { de: 'Kreativ', en: 'Creative', tr: 'Yaratıcı' },
    icon: '🎵',
    light: {
      '--bg':           '#faf5ff',
      '--bg-2':         '#f3e8ff',
      '--bg-3':         '#e9d5ff',
      '--surface':      '#ffffff',
      '--surface-2':    '#fdf8ff',
      '--border':       '#d8b4fe',
      '--text':         '#1e0a2e',
      '--text-2':       '#4a1a6a',
      '--text-3':       '#6b3a96',
      '--primary':      '#6d28d9',
      '--primary-fg':   '#ffffff',
      '--accent':       '#ec4899',
      '--accent-fg':    '#ffffff',
      '--danger':       '#dc2626',
      '--success':      '#059669',
      '--warning':      '#d97706',
      '--shadow':       '0 2px 20px rgba(109,40,217,0.1)',
      '--shadow-lg':    '0 8px 40px rgba(109,40,217,0.18)',
      '--radius':       '14px',
      '--radius-lg':    '22px',
    },
    dark: {
      '--bg':           '#0a0514',
      '--bg-2':         '#120a20',
      '--bg-3':         '#1a1030',
      '--surface':      '#150d25',
      '--surface-2':    '#1e1535',
      '--border':       '#2d1f50',
      '--text':         '#e9d5ff',
      '--text-2':       '#c084fc',
      '--text-3':       '#a879e6',
      '--primary':      '#a855f7',
      '--primary-fg':   '#0a0514',
      '--accent':       '#f472b6',
      '--accent-fg':    '#0a0514',
      '--danger':       '#f87171',
      '--success':      '#34d399',
      '--warning':      '#fbbf24',
      '--shadow':       '0 2px 20px rgba(0,0,0,0.6)',
      '--shadow-lg':    '0 8px 40px rgba(0,0,0,0.8)',
      '--radius':       '14px',
      '--radius-lg':    '22px',
    }
  },

  liquid: {
    name: { de: 'Liquid', en: 'Liquid', tr: 'Liquid' },
    icon: '🫧',
    light: {
      '--bg':           'rgba(255,255,255,0.10)',
      '--bg-2':         'rgba(255,255,255,0.22)',
      '--bg-3':         'rgba(255,255,255,0.32)',
      '--surface':      'rgba(255,255,255,0.82)',
      '--surface-2':    'rgba(255,255,255,0.64)',
      '--border':       'rgba(255,255,255,0.76)',
      '--text':         '#1C1C1E',
      '--text-2':       '#48484A',
      '--text-3':       'rgba(60,60,67,0.72)',
      '--primary':      '#007AFF',
      '--primary-fg':   '#ffffff',
      '--accent':       '#AF52DE',
      '--accent-fg':    '#ffffff',
      '--danger':       '#FF3B30',
      '--success':      '#34C759',
      '--warning':      '#FF9500',
      '--shadow':       '0 8px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
      '--shadow-lg':    '0 20px 60px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95)',
      '--radius':       '16px',
      '--radius-lg':    '26px',
      globalCss: `
        html[data-theme="liquid"] {
          background: linear-gradient(145deg, #C8D8F8 0%, #E0D0F8 40%, #F8E8F0 100%);
          background-attachment: fixed;
          min-height: 100vh;
        }
        html[data-theme="liquid"] body { background: transparent; }
        [data-theme="liquid"] .desktop-sidebar,
        [data-theme="liquid"] .mobile-header,
        [data-theme="liquid"] .mobile-bottom-nav {
          backdrop-filter: blur(64px) saturate(160%);
          -webkit-backdrop-filter: blur(64px) saturate(160%);
        }
        [data-theme="liquid"] ::-webkit-scrollbar { width: 4px; height: 4px; }
        [data-theme="liquid"] ::-webkit-scrollbar-track { background: transparent; }
        [data-theme="liquid"] ::-webkit-scrollbar-thumb { background: rgba(180,180,210,0.40); border-radius: 2px; }
      `,
    },
    dark: {
      '--bg':           'rgba(0,0,0,0.22)',
      '--bg-2':         'rgba(255,255,255,0.05)',
      '--bg-3':         'rgba(255,255,255,0.09)',
      '--surface':      'rgba(28,28,42,0.72)',
      '--surface-2':    'rgba(28,28,42,0.55)',
      '--border':       'rgba(255,255,255,0.11)',
      '--text':         '#F2F2F7',
      '--text-2':       '#EBEBF5',
      '--text-3':       'rgba(235,235,245,0.62)',
      '--primary':      '#0A84FF',
      '--primary-fg':   '#ffffff',
      '--accent':       '#BF5AF2',
      '--accent-fg':    '#ffffff',
      '--danger':       '#FF453A',
      '--success':      '#30D158',
      '--warning':      '#FF9F0A',
      '--shadow':       '0 4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
      '--shadow-lg':    '0 12px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
      '--radius':       '14px',
      '--radius-lg':    '22px',
      globalCss: `
        html[data-theme="liquid"] {
          background: linear-gradient(135deg, #0A1628 0%, #12093A 35%, #1E0A48 65%, #2A0A1E 100%);
          background-attachment: fixed;
          min-height: 100vh;
        }
        html[data-theme="liquid"] body { background: transparent; }
        [data-theme="liquid"] .desktop-sidebar,
        [data-theme="liquid"] .mobile-header,
        [data-theme="liquid"] .mobile-bottom-nav {
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
        }
        [data-theme="liquid"] ::-webkit-scrollbar { width: 4px; height: 4px; }
        [data-theme="liquid"] ::-webkit-scrollbar-track { background: transparent; }
        [data-theme="liquid"] ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }
      `,
    },
  },

  fresh: {
    name: { de: 'Fresh', en: 'Fresh', tr: 'Taze' },
    icon: '🎶',
    light: {
      '--bg':           '#f0fdf4',
      '--bg-2':         '#dcfce7',
      '--bg-3':         '#bbf7d0',
      '--surface':      '#ffffff',
      '--surface-2':    '#f7fdf9',
      '--border':       '#86efac',
      '--text':         '#052e16',
      '--text-2':       '#14532d',
      '--text-3':       '#166534',
      '--primary':      '#15803d',
      '--primary-fg':   '#ffffff',
      '--accent':       '#22c55e',
      '--accent-fg':    '#ffffff',
      '--danger':       '#dc2626',
      '--success':      '#16a34a',
      '--warning':      '#ca8a04',
      '--shadow':       '0 2px 20px rgba(21,128,61,0.08)',
      '--shadow-lg':    '0 8px 40px rgba(21,128,61,0.14)',
      '--radius':       '12px',
      '--radius-lg':    '20px',
    },
    dark: {
      '--bg':           '#020f06',
      '--bg-2':         '#051a0c',
      '--bg-3':         '#082814',
      '--surface':      '#061a0d',
      '--surface-2':    '#0a2415',
      '--border':       '#14532d',
      '--text':         '#bbf7d0',
      '--text-2':       '#86efac',
      '--text-3':       '#4ade80',
      '--primary':      '#22c55e',
      '--primary-fg':   '#020f06',
      '--accent':       '#4ade80',
      '--accent-fg':    '#020f06',
      '--danger':       '#f87171',
      '--success':      '#4ade80',
      '--warning':      '#fbbf24',
      '--shadow':       '0 2px 20px rgba(0,0,0,0.5)',
      '--shadow-lg':    '0 8px 40px rgba(0,0,0,0.7)',
      '--radius':       '12px',
      '--radius-lg':    '20px',
    }
  },
}

export const THEME_KEYS = Object.keys(THEMES)

const THEME_META_COLORS = {
  klassik: { light: '#faf8f4', dark: '#0f0d0a' },
  modern:  { light: '#f0f7f7', dark: '#050f0f' },
  bold:    { light: '#faf5f5', dark: '#0f0505' },
  kreativ: { light: '#faf5ff', dark: '#0a0514' },
  liquid:  { light: '#C8D8F8', dark: '#0A1628' },
  fresh:   { light: '#f0fdf4', dark: '#020f06' },
}

export function applyTheme(themeKey, darkMode) {
  const theme = THEMES[themeKey]
  if (!theme) return
  const vars = darkMode ? theme.dark : theme.light
  const root = document.documentElement
  root.setAttribute('data-transitioning', '')
  Object.entries(vars).forEach(([key, val]) => {
    if (key !== 'globalCss') root.style.setProperty(key, val)
  })
  root.setAttribute('data-theme', themeKey)
  root.setAttribute('data-mode', darkMode ? 'dark' : 'light')
  setTimeout(() => root.removeAttribute('data-transitioning'), 400)

  const metaColor = THEME_META_COLORS[themeKey]?.[darkMode ? 'dark' : 'light']
  if (metaColor) {
    const metaEl = document.querySelector('meta[name="theme-color"]')
    if (metaEl) metaEl.setAttribute('content', metaColor)
  }

  let styleEl = document.getElementById('staccato-theme-global')
  const css = vars.globalCss ?? ''
  if (css) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'staccato-theme-global'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = css
  } else if (styleEl) {
    styleEl.remove()
  }
}
