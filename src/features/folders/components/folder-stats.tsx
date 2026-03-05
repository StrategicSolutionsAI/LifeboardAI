"use client"

import { ListChecks, LayoutGrid, ShoppingCart, Calendar } from "lucide-react"

export interface BucketStatsData {
  tasks: number
  widgets: number
  shopping: number
  calendar: number
}

const STAT_CONFIG = [
  { key: "tasks" as const, icon: ListChecks, label: "tasks" },
  { key: "widgets" as const, icon: LayoutGrid, label: "widgets" },
  { key: "shopping" as const, icon: ShoppingCart, label: "shopping items" },
  { key: "calendar" as const, icon: Calendar, label: "calendar events" },
]

/** Convert hex to rgba */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Darken a hex color for text contrast */
function darkenHex(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount))
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount))
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount))
  return `rgb(${r}, ${g}, ${b})`
}

export function FolderStats({
  stats,
  visibleTypes,
  folderColor,
}: {
  stats: BucketStatsData
  visibleTypes?: Set<keyof BucketStatsData>
  folderColor?: string
}) {
  const items = STAT_CONFIG
    .filter((s) => !visibleTypes || visibleTypes.has(s.key))
    .filter((s) => stats[s.key] > 0)

  if (items.length === 0) return null

  const tintBg = folderColor ? hexToRgba(folderColor, 0.13) : "rgba(0,0,0,0.06)"
  const tintText = folderColor ? darkenHex(folderColor, 0.35) : undefined

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-2 sm:mt-2.5 flex-wrap">
      {items.map(({ key, icon: Icon, label }) => {
        const count = stats[key]
        return (
          <div
            key={key}
            className="flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1"
            style={{ backgroundColor: tintBg, color: tintText }}
            title={`${count} ${label}`}
          >
            <Icon className="w-2.5 h-2.5 sm:w-[13px] sm:h-[13px]" strokeWidth={2.2} />
            <span className="text-[10px] sm:text-[11px] font-semibold leading-none">
              {count > 99 ? "99+" : count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
