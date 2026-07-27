// Some development hosts export this flag for their own Electron process. electron-vite launches
// the Electron binary directly, so the child must not inherit Node compatibility mode.
delete process.env.ELECTRON_RUN_AS_NODE
process.env.ELECTRON_ENTRY = "desktop-dist/main.js"

const { createServer } = await import("electron-vite")

await createServer(
  {
    build: { watch: {} },
    ignoreConfigWarning: true,
  },
  { rendererOnly: false },
)

export {}
