import { rm } from "node:fs/promises"

import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite-plus"
import type { PluginOption, UserConfig } from "vite-plus"

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

const fmt = {
  ignorePatterns: ["dist", "node_modules", "bun.lock"],
  printWidth: 100,
  semi: false,
  sortImports: {
    order: "asc",
  },
  sortPackageJson: true,
  sortTailwindcss: {
    stylesheet: "./src/ui/styles.css",
  },
} satisfies NonNullable<UserConfig["fmt"]>

const lint = {
  categories: {
    correctness: "error",
  },
  env: {
    browser: true,
    es2024: true,
    node: true,
  },
  ignorePatterns: ["dist", "node_modules"],
  plugins: ["eslint", "import", "typescript"],
  rules: {
    "import/no-unassigned-import": "off",
  },
} satisfies NonNullable<UserConfig["lint"]>

const config = {
  fmt,
  lint,
  staged: {
    "*": "vp check --fix",
  },
  plugins: [
    removeBackgroundMetadata,
    babel({
      plugins: [["@locator/babel-jsx/dist", { env: "development" }]],
    }) as unknown as PluginOption,
    react() as unknown as PluginOption,
    tailwindcss() as unknown as PluginOption,
  ],
  build: {
    emptyOutDir: true,
    outDir: "dist/ui",
  },
  server: {
    port: 4178,
    proxy: {
      "/api": "http://127.0.0.1:4179",
    },
    strictPort: true,
  },
} satisfies UserConfig

export default defineConfig(config)
