"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Lazy-loaded Sentry — avoids pulling ~1000 modules into every page's bundle
let _sentry: Promise<typeof import('@sentry/nextjs')> | null = null;
function getSentry() {
  if (!_sentry) {
    _sentry = import('@sentry/nextjs');
  }
  return _sentry;
}

export default function PerfObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const page = pathname || "/";

    // Helper to send a breadcrumb for quick visibility in Sentry
    const log = (name: string, data: Record<string, unknown>) => {
      getSentry().then(Sentry => {
        Sentry.addBreadcrumb({
          category: "performance",
          message: `${name} (${page})`,
          level: "info",
          data,
        });
      });
    };

    // Navigation timing (initial load + soft navs where supported)
    try {
      const navEntries = performance.getEntriesByType("navigation");
      const nav = navEntries[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        log("navigation", {
          type: nav.type,
          ttfb: nav.responseStart - nav.requestStart,
          domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
          load: nav.loadEventEnd - nav.startTime,
        });
      }
    } catch {}

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (last) {
        log("LCP", { value: Math.round(last.startTime) });
      }
    });
    try { lcpObserver.observe({ type: "largest-contentful-paint", buffered: true as any }); } catch {}

    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          log("FCP", { value: Math.round(entry.startTime) });
        }
      }
    });
    try { fcpObserver.observe({ type: "paint", buffered: true as any }); } catch {}

    // Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const anyEntry = entry as any;
        if (!anyEntry.hadRecentInput) {
          clsValue += anyEntry.value || 0;
        }
      }
      log("CLS", { value: Number(clsValue.toFixed(4)) });
    });
    try { clsObserver.observe({ type: "layout-shift", buffered: true as any }); } catch {}

    return () => {
      try { lcpObserver.disconnect(); } catch {}
      try { fcpObserver.disconnect(); } catch {}
      try { clsObserver.disconnect(); } catch {}
    };
  }, [pathname]);

  return null;
}
