import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Se sirve en https://fluxcollect.com/ventas/ (subcarpeta de la landing en GitHub Pages).
export default defineConfig({
  base: '/ventas/',
  plugins: [react()],
})
