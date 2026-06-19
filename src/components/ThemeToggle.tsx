"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — render nothing until mounted
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <div className="h-7 w-7" />

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
    >
      {isDark
        ? <Sun className="h-3.5 w-3.5" />
        : <Moon className="h-3.5 w-3.5 text-gray-600" />}
    </button>
  )
}
