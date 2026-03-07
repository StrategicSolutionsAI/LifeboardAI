"use client";

import { useState } from "react";

/**
 * Manages collapse/expand states for dashboard sections.
 * Extracted from use-integrations to reduce re-render scope —
 * components that only read collapse states don't need to
 * re-render when integration data changes.
 */
export function useCollapseStates() {
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  const [isNext7DaysCollapsed, setIsNext7DaysCollapsed] = useState(false);
  const [isNext2WeeksCollapsed, setIsNext2WeeksCollapsed] = useState(false);
  const [isLaterCollapsed, setIsLaterCollapsed] = useState(false);
  const [isNoDueDateCollapsed, setIsNoDueDateCollapsed] = useState(true);

  return {
    isPlannerCollapsed, setIsPlannerCollapsed,
    isNext7DaysCollapsed, setIsNext7DaysCollapsed,
    isNext2WeeksCollapsed, setIsNext2WeeksCollapsed,
    isLaterCollapsed, setIsLaterCollapsed,
    isNoDueDateCollapsed, setIsNoDueDateCollapsed,
  };
}
