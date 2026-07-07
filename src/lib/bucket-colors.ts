const UNASSIGNED_BUCKET_ID = "__unassigned";
const BUCKET_COLOR_PALETTE = ["#92BEFB","#89BAA2","#DEA2BF","#85C9E0","#FFE4A8","#C3C0FF","#FFC688","#B0DBD2"] as const;

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

export function getBucketColorSync(bucketId: string, bucketColors?: Record<string, string>): string {
  if (bucketColors && bucketColors[bucketId]) {
    return bucketColors[bucketId];
  }
  return defaultBucketColorFromId(bucketId);
}

export function invalidateBucketColorCache(): void {
  // Emit custom event to notify components to refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
  }
}

export { UNASSIGNED_BUCKET_ID, BUCKET_COLOR_PALETTE };
