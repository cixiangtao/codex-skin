import { createRoot } from "react-dom/client"

import { App } from "./app.tsx"

import "./styles.css"

const root = document.querySelector("#root")
if (!root) throw new Error("Missing React root element")

createRoot(root).render(<App />)
