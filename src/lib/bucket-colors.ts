import { getUserPreferencesClient } from "./user-preferences";

const UNASSIGNED_BUCKET_ID = "__unassigned";
const BUCKET_COLOR_PALETTE = ["#6B8AF7","#48B882","#D07AA4","#4AADE0","#C4A44E","#8B7FD4","#E28A5D","#5E9B8C"] as const;

let cachedBucketColors: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function defaultBucketColorFromId(id: string): string {
  if (id === UNASSIGNED_BUCKET_ID) return "#8e99a8";
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
  if (cachedBucketColors && (now - cacheTimestamp) < CACHE_DURATION) {
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

export { UNASSIGNED_BUCKET_ID, BUCKET_COLOR_PALETTE };