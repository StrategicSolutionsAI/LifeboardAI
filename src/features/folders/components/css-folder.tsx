"use client"

import { CSSProperties } from "react"
import styles from "./css-folder.module.css"
import { FolderStats, type BucketStatsData } from "./folder-stats"

interface CSSFolderProps {
  label: string
  color?: string
  empty?: boolean
  onClick?: () => void
  stats?: BucketStatsData
  visibleStatTypes?: Set<keyof BucketStatsData>
}

/** Darken a hex color by mixing with black */
function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * (1 - amount))
  const dg = Math.round(g * (1 - amount))
  const db = Math.round(b * (1 - amount))
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`
}

export function CSSFolder({ label, color = "#4786ff", empty = false, onClick, stats, visibleStatTypes }: CSSFolderProps) {
  const folderStyle = {
    "--folder-back": darken(color, 0.12),
    "--folder-front": color,
  } as CSSProperties

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.folder} ${empty ? styles.empty : ""}`}
      style={folderStyle}
      onClick={onClick}
    >
      <div className={styles.folderBack}>
        {!empty && (
          <>
            <div className={styles.paper} />
            <div className={styles.paper} />
            <div className={styles.paper} />
          </>
        )}
        <div className={styles.folderFront} />
        <div className={`${styles.folderFront} ${styles.folderFrontRight}`} />
      </div>
      <div className={styles.label}>{label}</div>
      {stats && <FolderStats stats={stats} visibleTypes={visibleStatTypes} folderColor={color} />}
    </div>
  )
}
