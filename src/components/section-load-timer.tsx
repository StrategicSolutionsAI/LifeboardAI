"use client";

import { useEffect } from 'react';
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor';

export default function SectionLoadTimer({ name, meta = {} }: { name: string; meta?: Record<string, any> }) {
  const { markComplete } = usePerformanceMonitor(`Route: ${name}`, meta);
  useEffect(() => {
    // Mark after paint to approximate route mount time
    const id = requestAnimationFrame(() => {
      markComplete();
    });
    return () => cancelAnimationFrame(id);
  }, [markComplete]);
  return null;
}

