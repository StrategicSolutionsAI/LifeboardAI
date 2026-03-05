export interface ProgressEntry {
  value: number;
  date: string;
  streak: number;
  lastCompleted: string;
}

// Re-export shared types from dashboard-utils for convenience
export type {
  ProfileNameRow,
  WidgetLogEntry,
  DestructiveConfirmState,
  UndoState,
} from "@/lib/dashboard-utils";
