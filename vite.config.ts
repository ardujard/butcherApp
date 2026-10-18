/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/butcherApp/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Butcher Counter Stock Tracker',
        short_name: 'Stock Tracker',
        description: 'Tracks which production dates make up the counter stock for each product.',
        theme_color: '#1f2933',
        background_color: '#1f2933',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Calendar days come from the device clock, so pin the zone the iPad
    // runs in; otherwise date tests pass or fail depending on the machine.
    env: { TZ: 'Europe/Brussels' },
    // e2e/ holds Playwright specs, which vitest would otherwise collect by
    // name and fail to run.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})
