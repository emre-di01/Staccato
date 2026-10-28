import RechtsRahmen, { link } from '../neu/seiten/RechtsRahmen'

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
    name: 'DOMPurify',
    version: '3',
    lizenz: 'Apache 2.0',
    autor: 'cure53 / Mario Heiderich',
    url: 'https://github.com/cure53/DOMPurify',
    zweck: 'XSS-Sanitisierung von HTML-Inhalten',
  },
  {
    name: 'PDF.js (pdfjs-dist)',
    version: '5',
    lizenz: 'Apache 2.0',
    autor: 'Mozilla Foundation',
    url: 'https://mozilla.github.io/pdf.js',
    zweck: 'PDF-Anzeige direkt im Browser',
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
    name: '@capacitor/core',
    version: '7',
    lizenz: 'MIT',
    autor: 'Ionic, Inc.',
    url: 'https://capacitorjs.com',
    zweck: 'Native App-Bridge (Web → Android/iOS)',
  },
  {
    name: '@capacitor/android',
    version: '7',
    lizenz: 'MIT',
    autor: 'Ionic, Inc.',
    url: 'https://capacitorjs.com',
    zweck: 'Android-Plattform-Unterstützung für Capacitor',
  },
  {
    name: '@capacitor/push-notifications',
    version: '8',
    lizenz: 'MIT',
    autor: 'Ionic, Inc.',
    url: 'https://capacitorjs.com/docs/apis/push-notifications',
    zweck: 'Native Push-Benachrichtigungen (Android via FCM)',
  },
  {
    name: 'react-onesignal',
    version: '3',
    lizenz: 'MIT',
    autor: 'OneSignal',
    url: 'https://github.com/OneSignal/react-onesignal',
    zweck: 'Web Push-Benachrichtigungen (Browser)',
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

export default function Lizenzen() {
  return (
    <RechtsRahmen titel="Open-Source-Lizenzen" unter="Staccato wurde mit folgenden Open-Source-Bibliotheken gebaut. Wir danken allen Entwicklerinnen und Entwicklern für ihre Arbeit.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PAKETE.map(paket => (
          <div key={paket.name} style={{ background: 'var(--n-fill, var(--surface))', borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <a href={paket.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', textDecoration: 'none', overflowWrap: 'anywhere' }}>{paket.name}</a>
                <span style={{ fontSize: 15, color: 'var(--text-2)' }}>v{paket.version}</span>
              </div>
              <div style={{ marginTop: 2, fontSize: 15, color: 'var(--text-2)' }}>{paket.zweck}</div>
              <div style={{ marginTop: 2, fontSize: 15, color: 'var(--text-2)' }}>{paket.autor}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'var(--n-tint, var(--bg-2))', color: 'var(--n-tint-fg, var(--primary))', whiteSpace: 'nowrap', flexShrink: 0 }}>{paket.lizenz}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: 20, background: 'var(--n-fill, var(--surface))', borderRadius: 18, fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>MIT License</strong> — Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.<br /><br />
        <strong style={{ color: 'var(--text)' }}>Apache License 2.0</strong> — Licensed under the Apache License, Version 2.0; you may not use a file except in compliance with the License. You may obtain a copy at <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" style={link}>apache.org/licenses/LICENSE-2.0</a>.
      </div>

    </RechtsRahmen>
  )
}
