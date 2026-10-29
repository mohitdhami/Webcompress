import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    // Inline the 7-Zip WASM and fonts into the single HTML file.
    assetsInlineLimit: 100_000_000,
  },
})
