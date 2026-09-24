import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Se sirve en https://fluxcollect.com/ventas/ (subcarpeta de la landing en GitHub Pages).
export default defineConfig({
  base: '/ventas/',
  plugins: [react()],
  build: {
    // SheetJS (~490 kB) se carga a demanda solo al importar/exportar; el resto
    // del bundle inicial es React + supabase-js. No hace falta el aviso de 500 kB.
    chunkSizeWarningLimit: 800,
  },
})
