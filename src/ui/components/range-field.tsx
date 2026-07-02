import type { CSSProperties } from "react"

import { cn } from "../lib/cn.ts"
import type { RangeKey } from "../types.ts"

interface RangeStyle extends CSSProperties {
  "--range-fill": string
}

interface RangeFieldProps {
  className?: string
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
  className,
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
    <label className={cn("mt-3.5 block", className)} htmlFor={name}>
      <span className="mb-2 flex items-center justify-between text-[10px]">
        {label}{" "}
        <output className="font-mono text-[9px] text-leaf" htmlFor={name}>
          {output}
        </output>
      </span>
      <input
        className="m-0 h-1 w-full cursor-pointer appearance-none rounded-[10px] [background:linear-gradient(90deg,var(--color-leaf)_var(--range-fill,0%),rgb(24_37_31/0.1)_var(--range-fill,0%))] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-leaf [&::-webkit-slider-thumb]:bg-paper [&::-webkit-slider-thumb]:shadow-[0_2px_7px_rgb(24_37_31/0.14)]"
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
