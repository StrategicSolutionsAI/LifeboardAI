"use client";

let dashboardAssetsPrefetched = false;

/**
 * Warm the ssr:false taskboard chunk for /dashboard ahead of navigation.
 * dynamic() chunks are not covered by <Link> prefetch, so without this the
 * ~214KB chunk only starts downloading after the click commits.
 */
export async function prefetchDashboardExperience() {
  if (dashboardAssetsPrefetched) {
    return;
  }

  dashboardAssetsPrefetched = true;

  await Promise.allSettled([
    import("@/features/dashboard/components/taskboard-dashboard"),
  ]);
}
