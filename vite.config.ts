import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
// '/' is for local run/testing and '/Crochet-Editor/' is for Github Pages build
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/Crochet-Editor/' : '/'
}))
