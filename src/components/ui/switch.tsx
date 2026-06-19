import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          ref={ref}
          className="sr-only peer"
          {...props}
        />
        <div className={cn(
          "w-9 h-5 bg-[var(--bg-card)] border border-[#ffffff15] rounded-full peer peer-focus:ring-1 peer-focus:ring-whatsapp/50",
          "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-500/20 after:border after:rounded-full after:h-4 after:w-4 after:transition-all",
          "peer-checked:after:translate-x-[16px] peer-checked:after:bg-black peer-checked:after:border-transparent",
          "peer-checked:bg-whatsapp peer-checked:border-whatsapp",
          className
        )} />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
