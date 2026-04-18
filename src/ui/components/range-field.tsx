import type { CSSProperties } from "react"

import type { RangeKey } from "../types.ts"

interface RangeStyle extends CSSProperties {
  "--range-fill": string
}

interface RangeFieldProps {
  label: string
  max: number
  min: number
  name: RangeKey
  onChange: (value: number) => void
  output: string
  step: number
  value: number
}

function rangeStyle(value: number, min: number, max: number): RangeStyle {
  return { "--range-fill": `${((value - min) / (max - min)) * 100}%` }
}

/** Renders a controlled range input with its live value and filled track. */
export function RangeField({
  label,
  max,
  min,
  name,
  onChange,
  output,
  step,
  value,
}: RangeFieldProps) {
  return (
    <label className="range-field" htmlFor={name}>
      <span>
        {label} <output htmlFor={name}>{output}</output>
      </span>
      <input
        id={name}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={rangeStyle(value, min, max)}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}
