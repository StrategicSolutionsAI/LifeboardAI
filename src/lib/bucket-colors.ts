import { getUserPreferencesClient } from "./user-preferences";
import { BUCKET_COLORS_CACHE_TTL_MS } from "@/lib/cache-config";

const UNASSIGNED_BUCKET_ID = "__unassigned";
const BUCKET_COLOR_PALETTE = ["#92BEFB","#89BAA2","#DEA2BF","#85C9E0","#FFE4A8","#C3C0FF","#FFC688","#B0DBD2"] as const;

let cachedBucketColors: Record<string, string> | null = null;
let cacheTimestamp = 0;

function defaultBucketColorFromId(id: string): string {
  if (id === UNASSIGNED_BUCKET_ID) return "#A9B0C5";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % BUCKET_COLOR_PALETTE.length;
  return BUCKET_COLOR_PALETTE[idx];
}

async function getBucketColors(): Promise<Record<string, string>> {
  const now = Date.now();

  // Return cached colors if still valid
  if (cachedBucketColors && (now - cacheTimestamp) < BUCKET_COLORS_CACHE_TTL_MS) {
    return cachedBucketColors;
  }

  try {
    const prefs = await getUserPreferencesClient();
    const colors = prefs?.bucket_colors || {};
    cachedBucketColors = colors;
    cacheTimestamp = now;
    return colors;
  } catch (error) {
    console.error("Failed to load bucket colors:", error);
    return {};
  }
}

export async function getBucketColor(bucketId: string): Promise<string> {
  const bucketColors = await getBucketColors();
  return bucketColors[bucketId] || defaultBucketColorFromId(bucketId);
}

export function getBucketColorSync(bucketId: string, bucketColors?: Record<string, string>): string {
  if (bucketColors && bucketColors[bucketId]) {
    return bucketColors[bucketId];
  }
  return defaultBucketColorFromId(bucketId);
}

export function invalidateBucketColorCache(): void {
  cachedBucketColors = null;
  cacheTimestamp = 0;

  // Emit custom event to notify components to refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
  }
}

/** Return a very dark shade of a hex color (factor 0 = black, 1 = original). */
export function darkenHexColor(hex: string, factor = 0.38): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export { UNASSIGNED_BUCKET_ID, BUCKET_COLOR_PALETTE };