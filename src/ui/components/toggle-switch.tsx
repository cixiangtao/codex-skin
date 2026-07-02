import { cn } from "../lib/cn.ts"

interface ToggleSwitchProps {
  checked: boolean
  compact?: boolean
  disabled: boolean
  label: string
  name: string
  onChange: (checked: boolean) => void
}

/** Renders the shared enabled-state toggle used by global and surface controls. */
export function ToggleSwitch({
  checked,
  compact = false,
  disabled,
  label,
  name,
  onChange,
}: ToggleSwitchProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center text-[10px] text-ink/48",
        compact ? "gap-1.5" : "gap-2",
      )}
    >
      <input
        className="peer sr-only"
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span
        className={cn(
          "relative rounded-full border border-ink/12 bg-ink/10 peer-checked:border-leaf/35 peer-checked:bg-leaf/17 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-leaf",
          "[&>i]:absolute [&>i]:top-[3px] [&>i]:left-[3px] [&>i]:rounded-full [&>i]:bg-[#8c948f] [&>i]:transition [&>i]:duration-180",
          "peer-checked:[&>i]:bg-leaf",
          compact
            ? "h-[18px] w-[31px] [&>i]:size-2.5 peer-checked:[&>i]:translate-x-[13px]"
            : "h-5 w-9 [&>i]:size-3 peer-checked:[&>i]:translate-x-4",
        )}
        aria-hidden="true"
      >
        <i />
      </span>
      <b className="font-semibold peer-checked:text-ink">{label}</b>
    </label>
  )
}
