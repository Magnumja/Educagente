import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    host: true, // libera acesso pelos outros computadores do laboratório
    // changeOrigin: o Django recebe Host localhost:8000 mesmo quando o aluno acessa pelo IP do professor.
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
})
