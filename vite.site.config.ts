import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.CODEX_SKIN_SITE_BASE || "/codex-skin/",
  root: path.join(projectRoot, "apps/site"),
  plugins: [react(), tailwindcss()],
  build: {
    emptyOutDir: true,
    outDir: path.join(projectRoot, "site-dist"),
    reportCompressedSize: true,
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
})
