import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite-plus"
import type { PluginOption, UserConfig } from "vite-plus"

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
  plugins: [tailwindcss() as unknown as PluginOption],
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
