import { useState, useEffect } from 'react';
import { getUserPreferencesClient } from '@/lib/user-preferences';

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
          setBuckets(prefs.life_buckets);
          const initialActive = localActiveBucket && prefs.life_buckets.includes(localActiveBucket) 
            ? localActiveBucket 
            : prefs.life_buckets[0];
          setActiveBucket(initialActive);
        }
      } catch (error) {
        console.error('Error loading buckets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBuckets();
  }, []);

  return { buckets, activeBucket, loading };
}