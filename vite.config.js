import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@xenova/transformers', 'verovio'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/lib/__tests__/setupIntegration.js'],
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/i18n/**'],
      reporter: ['text', 'html'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Staccato – Musikschule',
        short_name: 'Staccato',
        description: 'Musikschule Management System',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0d0a',
        theme_color: '#c9a84c',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/*verovio*'],
      },
    }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-misc': ['@tanstack/react-query', 'marked'],
          'vendor-pdfjs': ['pdfjs-dist'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
