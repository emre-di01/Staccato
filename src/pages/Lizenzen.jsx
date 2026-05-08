import { useNavigate } from 'react-router-dom'

const PAKETE = [
  {
    name: 'React',
    version: '18',
    lizenz: 'MIT',
    autor: 'Meta Platforms, Inc.',
    url: 'https://react.dev',
    zweck: 'UI-Framework',
  },
  {
    name: 'React DOM',
    version: '18',
    lizenz: 'MIT',
    autor: 'Meta Platforms, Inc.',
    url: 'https://react.dev',
    zweck: 'DOM-Rendering für React',
  },
  {
    name: 'React Router DOM',
    version: '6',
    lizenz: 'MIT',
    autor: 'Remix Software, Inc.',
    url: 'https://reactrouter.com',
    zweck: 'Client-seitiges Routing',
  },
  {
    name: 'react-error-boundary',
    version: '6',
    lizenz: 'MIT',
    autor: 'Brian Vaughn',
    url: 'https://github.com/bvaughn/react-error-boundary',
    zweck: 'Fehlerbehandlung in React-Komponentenbäumen',
  },
  {
    name: '@supabase/supabase-js',
    version: '2',
    lizenz: 'MIT',
    autor: 'Supabase, Inc.',
    url: 'https://supabase.com',
    zweck: 'Datenbank, Authentifizierung, Realtime, Storage',
  },
  {
    name: '@tanstack/react-query',
    version: '5',
    lizenz: 'MIT',
    autor: 'Tanner Linsley / TanStack',
    url: 'https://tanstack.com/query',
    zweck: 'Asynchrones Datenfetching und Caching',
  },
  {
    name: 'marked',
    version: '18',
    lizenz: 'MIT',
    autor: 'Christopher Jeffrey',
    url: 'https://marked.js.org',
    zweck: 'Markdown-Rendering (Liedtexte, Inhalte)',
  },
  {
    name: 'qrcode',
    version: '1',
    lizenz: 'MIT',
    autor: 'soldair',
    url: 'https://github.com/soldair/node-qrcode',
    zweck: 'QR-Code-Generierung für Live-Sessions',
  },
  {
    name: 'jsQR',
    version: '1',
    lizenz: 'Apache 2.0',
    autor: 'Cosmo Wolfe',
    url: 'https://github.com/cozmo/jsQR',
    zweck: 'QR-Code-Scanning (Kamera)',
  },
  {
    name: 'Vite',
    version: '5',
    lizenz: 'MIT',
    autor: 'Evan You',
    url: 'https://vite.dev',
    zweck: 'Build-Tool und Dev-Server',
  },
  {
    name: '@vitejs/plugin-react',
    version: '4',
    lizenz: 'MIT',
    autor: 'Evan You',
    url: 'https://github.com/vitejs/vite-plugin-react',
    zweck: 'React-Integration für Vite (Fast Refresh)',
  },
  {
    name: 'vite-plugin-pwa',
    version: '1',
    lizenz: 'MIT',
    autor: 'Anthony Fu',
    url: 'https://vite-pwa-org.netlify.app',
    zweck: 'Progressive Web App (Service Worker, Manifest)',
  },
]

const LIZENZ_FARBEN = {
  'MIT':        { bg: '#10b98122', text: '#10b981' },
  'Apache 2.0': { bg: '#f59e0b22', text: '#d97706' },
}

export default function Lizenzen() {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 24px', display:'block' }}>
        ← Zurück
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Open-Source-Lizenzen</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>
        Staccato wurde mit folgenden Open-Source-Bibliotheken gebaut. Wir danken allen Entwicklerinnen und Entwicklern für ihre Arbeit.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PAKETE.map(p => {
          const lf = LIZENZ_FARBEN[p.lizenz] ?? { bg: '#6366f122', text: '#6366f1' }
          return (
            <div key={p.name} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:15, fontWeight:700, color:'var(--primary)', textDecoration:'none' }}>
                    {p.name}
                  </a>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>v{p.version}</span>
                </div>
                <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:4 }}>{p.zweck}</div>
                <div style={{ fontSize:12, color:'var(--text-3)' }}>{p.autor}</div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:99, background: lf.bg, color: lf.text, whiteSpace:'nowrap', flexShrink:0 }}>
                {p.lizenz}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 40, padding: '20px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, color:'var(--text-3)', lineHeight:1.7 }}>
        <strong style={{ color:'var(--text-2)' }}>MIT License</strong> — Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.<br /><br />
        <strong style={{ color:'var(--text-2)' }}>Apache License 2.0</strong> — Licensed under the Apache License, Version 2.0; you may not use a file except in compliance with the License. You may obtain a copy at <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" style={{ color:'var(--primary)', textDecoration:'none' }}>apache.org/licenses/LICENSE-2.0</a>.
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-3)' }}>
        <a href="/impressum" style={{ color:'var(--primary)', textDecoration:'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color:'var(--primary)', textDecoration:'none' }}>Datenschutzerklärung</a>
      </div>
    </div>
  )
}
