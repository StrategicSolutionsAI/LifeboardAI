import { useState, useEffect } from 'react';
import { getUserPreferencesClient, saveUserPreferences } from '@/lib/user-preferences';

export function useBuckets() {
  const [buckets, setBuckets] = useState<string[]>(['Health', 'Work', 'Personal', 'Finance']);
  const [activeBucket, setActiveBucket] = useState<string>('Health');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBuckets = async () => {
      try {
        // Load from localStorage first for fast access
        const localBuckets = typeof window !== 'undefined' 
          ? localStorage.getItem('life_buckets')
          : null;
        
        const localActiveBucket = typeof window !== 'undefined'
          ? localStorage.getItem('active_bucket')
          : null;

        if (localBuckets) {
          const parsed = JSON.parse(localBuckets);
          setBuckets(parsed);
          if (localActiveBucket && parsed.includes(localActiveBucket)) {
            setActiveBucket(localActiveBucket);
          } else if (parsed.length > 0) {
            setActiveBucket(parsed[0]);
          }
        }

        // Then load from Supabase (source of truth)
        const prefs = await getUserPreferencesClient();
        if (prefs?.life_buckets && prefs.life_buckets.length > 0) {
          const localList: string[] = (localBuckets ? JSON.parse(localBuckets) : []) || [];
          const serverList: string[] = prefs.life_buckets || [];
          const union = Array.from(new Set([...(Array.isArray(localList) ? localList : []), ...serverList]));

          // Use the union in UI
          setBuckets(union);
          const initialActive = localActiveBucket && union.includes(localActiveBucket)
            ? localActiveBucket
            : union[0];
          if (initialActive) setActiveBucket(initialActive);

          // Persist union back to localStorage and Supabase if it adds anything new
          if (union.length !== serverList.length) {
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem('life_buckets', JSON.stringify(union));
                window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
              }
              await saveUserPreferences({ ...prefs, life_buckets: union });
            } catch (e) {
              console.error('Failed to persist merged buckets', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading buckets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBuckets();

    // React to broadcast events from dashboard/settings and cross-tab storage changes
    const onBucketsChanged = () => {
      // Quickly reload; keep UX snappy
      loadBuckets();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'life_buckets') loadBuckets();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('lifeBucketsChanged', onBucketsChanged);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('lifeBucketsChanged', onBucketsChanged);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  return { buckets, activeBucket, loading };
}