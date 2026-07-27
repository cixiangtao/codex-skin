import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "electron-vite"

import { createRendererConfig } from "./vite.renderer.config.ts"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(async ({ mode }) => ({
  ...(mode === "renderer-only"
    ? {}
    : {
        main: {
          build: {
            emptyOutDir: true,
            externalizeDeps: false,
            outDir: path.join(projectRoot, "desktop-dist"),
            rollupOptions: {
              input: path.join(projectRoot, "src/desktop/main.ts"),
              output: {
                entryFileNames: "main.js",
              },
            },
          },
        },
      }),
  renderer: await createRendererConfig(),
}))
