import { useEffect, useState } from 'react';
import { getUserPreferencesClient } from '@/lib/user-preferences';

const DEFAULT_BUCKETS = ['Health', 'Work', 'Personal', 'Finance'];
const BUCKETS_CACHE_TTL_MS = 2 * 60 * 1000;

interface BucketSnapshot {
  buckets: string[];
  activeBucket: string;
  timestamp: number;
}

let bucketsSnapshot: BucketSnapshot | null = null;
let inFlightBucketsRequest: Promise<BucketSnapshot> | null = null;

function normalizeBuckets(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function readLocalSnapshot(): BucketSnapshot {
  if (typeof window === 'undefined') {
    return {
      buckets: DEFAULT_BUCKETS,
      activeBucket: DEFAULT_BUCKETS[0],
      timestamp: Date.now(),
    };
  }

  let parsedRaw: unknown = [];
  try {
    parsedRaw = JSON.parse(localStorage.getItem('life_buckets') || '[]');
  } catch (error) {
    parsedRaw = [];
  }
  const parsedBuckets = normalizeBuckets(parsedRaw);
  const buckets = parsedBuckets.length > 0 ? parsedBuckets : DEFAULT_BUCKETS;
  const storedActive = localStorage.getItem('active_bucket');
  const activeBucket = storedActive && buckets.includes(storedActive)
    ? storedActive
    : buckets[0];

  return { buckets, activeBucket, timestamp: Date.now() };
}

function writeLocalBuckets(snapshot: BucketSnapshot) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('life_buckets', JSON.stringify(snapshot.buckets));
  if (snapshot.activeBucket) {
    localStorage.setItem('active_bucket', snapshot.activeBucket);
  }
}

async function fetchBucketsSnapshot(force = false): Promise<BucketSnapshot> {
  const now = Date.now();
  if (!force && bucketsSnapshot && now - bucketsSnapshot.timestamp < BUCKETS_CACHE_TTL_MS) {
    return bucketsSnapshot;
  }

  if (inFlightBucketsRequest) {
    return inFlightBucketsRequest;
  }

  inFlightBucketsRequest = (async () => {
    const localSnapshot = readLocalSnapshot();

    try {
      const prefs = await getUserPreferencesClient();
      const remoteBuckets = normalizeBuckets(prefs?.life_buckets ?? []);

      const mergedBuckets = remoteBuckets.length > 0
        ? Array.from(new Set([...localSnapshot.buckets, ...remoteBuckets]))
        : localSnapshot.buckets;

      const activeBucket = mergedBuckets.includes(localSnapshot.activeBucket)
        ? localSnapshot.activeBucket
        : mergedBuckets[0];

      const nextSnapshot: BucketSnapshot = {
        buckets: mergedBuckets.length > 0 ? mergedBuckets : DEFAULT_BUCKETS,
        activeBucket: activeBucket || DEFAULT_BUCKETS[0],
        timestamp: Date.now(),
      };

      bucketsSnapshot = nextSnapshot;
      writeLocalBuckets(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      console.error('Error loading buckets:', error);
      bucketsSnapshot = localSnapshot;
      return localSnapshot;
    } finally {
      inFlightBucketsRequest = null;
    }
  })();

  return inFlightBucketsRequest;
}

export function useBuckets() {
  const initialSnapshot = bucketsSnapshot ?? readLocalSnapshot();
  const [buckets, setBuckets] = useState<string[]>(initialSnapshot.buckets);
  const [activeBucket, setActiveBucket] = useState<string>(initialSnapshot.activeBucket);
  const [loading, setLoading] = useState(!bucketsSnapshot);

  useEffect(() => {
    let mounted = true;

    const applySnapshot = (snapshot: BucketSnapshot) => {
      if (!mounted) return;
      setBuckets(snapshot.buckets);
      setActiveBucket(snapshot.activeBucket);
      setLoading(false);
    };

    // Instant hydration from local storage
    applySnapshot(readLocalSnapshot());

    fetchBucketsSnapshot()
      .then(applySnapshot)
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const syncFromStorage = () => {
      const snapshot = readLocalSnapshot();
      bucketsSnapshot = snapshot;
      applySnapshot(snapshot);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'life_buckets' || event.key === 'active_bucket') {
        syncFromStorage();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('lifeBucketsChanged', syncFromStorage);
      window.addEventListener('storage', onStorage);
    }

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('lifeBucketsChanged', syncFromStorage);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  return { buckets, activeBucket, loading };
}
