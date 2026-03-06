import { WIDGET_MODAL_REGISTRY } from '@/features/widgets/widget-modal-registry'

// ── Module-scope constants (allocated once, never recreated per render) ───

/** Derived from the widget modal registry — auto-updates when new widgets are added */
export const MODAL_WIDGET_IDS = new Set(Object.keys(WIDGET_MODAL_REGISTRY));

export const SUGGESTED_BUCKETS = [
  'Health', 'Wellness', 'Family', 'Social', 'Work',
  'Finance', 'Personal', 'Fitness', 'Projects', 'Home',
] as const;

export const SUGGESTED_BUCKET_COLOR_MAP: Record<string, string> = {
  health: '#48B882', wellness: '#5E9B8C', family: '#4AADE0',
  social: '#D07AA4', work: '#B1916A', personal: '#8B7FD4',
  projects: '#6B8AF7', home: '#5E9B8C', finance: '#C4A44E',
  fitness: '#E28A5D',
};

export function getSuggestedColorForBucket(name: string): string {
  const key = name?.toLowerCase?.().trim() || '';
  return SUGGESTED_BUCKET_COLOR_MAP[key] || '#B1916A';
}

export function formatTimeUntilDue(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 7) return '1 week';
  if (days < 7) return `${days} days`;
  if (days < 14) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  return `${Math.floor(days / 30)} months`;
}
