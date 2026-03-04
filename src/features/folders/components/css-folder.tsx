"use client"

import { CSSProperties } from "react"
import styles from "./css-folder.module.css"

interface CSSFolderProps {
  label: string
  color?: string
  empty?: boolean
  onClick?: () => void
}

/** Lighten a hex color by mixing with white */
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`
}

export function CSSFolder({ label, color = "#4786ff", empty = false, onClick }: CSSFolderProps) {
  const folderStyle = {
    "--folder-back": color,
    "--folder-front": lighten(color, 0.3),
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
    </div>
  )
}
