import { rm } from "node:fs/promises"

import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import type { PluginOption, UserConfig } from "vite"

const backgroundMetadataPaths = [
  "dist/ui/backgrounds/.DS_Store",
  "dist/ui/backgrounds/wallpaper/.DS_Store",
  "dist/ui/backgrounds/main/.DS_Store",
  "dist/ui/backgrounds/sidebar/.DS_Store",
]

const removeBackgroundMetadata = {
  name: "remove-background-macos-metadata",
  closeBundle: async () => {
    await Promise.all(
      backgroundMetadataPaths.map((metadataPath) => rm(metadataPath, { force: true })),
    )
  },
} satisfies PluginOption

/** Creates fresh renderer plugins for Vite and electron-vite config resolution. */
export async function createRendererConfig() {
  return {
    root: ".",
    plugins: [
      removeBackgroundMetadata,
      (await babel({
        plugins: [["@locator/babel-jsx/dist", { env: "development" }]],
      })) as unknown as PluginOption,
      react() as unknown as PluginOption,
      tailwindcss() as unknown as PluginOption,
    ],
    build: {
      emptyOutDir: true,
      minify: true,
      outDir: "dist/ui",
      reportCompressedSize: true,
      rollupOptions: {
        input: "index.html",
      },
    },
    server: {
      host: "127.0.0.1",
      port: 4178,
      proxy: {
        "/api": "http://127.0.0.1:4179",
      },
      strictPort: true,
    },
  } satisfies UserConfig
}

export default defineConfig(createRendererConfig)
