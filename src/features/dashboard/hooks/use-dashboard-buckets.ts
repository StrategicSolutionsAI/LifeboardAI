"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import type { WidgetInstance } from "@/types/widgets";
import { getUserPreferencesClient, updateUserPreferenceFields, getCachedUser, invalidatePreferencesCache } from "@/lib/user-preferences";
import { ensureCacheOwner } from "@/lib/auth-cleanup";
import { debounce } from "@/lib/dashboard-utils";
import { SUGGESTED_BUCKETS, getSuggestedColorForBucket } from "@/features/dashboard/constants";
import type { DestructiveConfirmState, UndoState } from "@/features/dashboard/types";

// ---------------------------------------------------------------------------
// Bucket sync helpers
// ---------------------------------------------------------------------------
const markBucketsSaved = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('life_buckets_saved_at', String(Date.now()));
  }
};
const markBucketsSynced = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('life_buckets_synced_at', String(Date.now()));
  }
};
const hasUnsyncedBucketChanges = (): boolean => {
  if (typeof window === 'undefined') return false;
  const savedAt = Number(localStorage.getItem('life_buckets_saved_at') || '0');
  const syncedAt = Number(localStorage.getItem('life_buckets_synced_at') || '0');
  return savedAt > syncedAt;
};

// ---------------------------------------------------------------------------
// Hook options & return types
// ---------------------------------------------------------------------------
interface UseDashboardBucketsOptions {
  user: User | null;
  authInitialized: boolean;
  pushUndo: (message: string, onUndo: () => Promise<void> | void) => void;
  setConfirmState: (state: DestructiveConfirmState | null) => void;
  /** Called when a bucket is removed — orchestrator should clean widget data */
  onBucketRemoved: (bucket: string) => Promise<{
    cleanedWidgets: Record<string, WidgetInstance[]>;
    cleanedColors: Record<string, string>;
  }>;
  /** Called when a bucket is renamed — orchestrator should move widget data */
  onBucketRenamed: (oldName: string, newName: string) => void;
  /** Returns a snapshot of the current widgets-by-bucket state */
  getWidgetSnapshot: () => Record<string, WidgetInstance[]>;
  /** Restores a previous widgets-by-bucket state (for undo) */
  restoreWidgets: (widgets: Record<string, WidgetInstance[]>) => void;
}

export interface UseDashboardBucketsReturn {
  buckets: string[];
  setBuckets: React.Dispatch<React.SetStateAction<string[]>>;
  activeBucket: string;
  setActiveBucket: React.Dispatch<React.SetStateAction<string>>;
  bucketsInitialized: boolean;
  setBucketsInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  bucketColors: Record<string, string>;
  setBucketColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  bucketsRef: React.MutableRefObject<string[]>;
  isEditorOpen: boolean;
  setIsEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newBucket: string;
  setNewBucket: React.Dispatch<React.SetStateAction<string>>;
  editingBucketName: string | null;
  setEditingBucketName: React.Dispatch<React.SetStateAction<string | null>>;
  editingBucketNewName: string;
  setEditingBucketNewName: React.Dispatch<React.SetStateAction<string>>;
  draggedBucketIndex: number | null;
  dragIndexRef: React.MutableRefObject<number | null>;
  manageDragIndexRef: React.MutableRefObject<number | null>;
  suggestedToShow: string[];
  getBucketColor: (bucket: string) => string;
  handleAddBucket: () => Promise<void>;
  handleAddBucketQuick: (name: string) => Promise<void>;
  requestRemoveBucket: (bucket: string) => void;
  handleBucketColorChange: (bucket: string, colorHex: string) => Promise<void>;
  handleStartEditBucket: (bucket: string) => void;
  handleSaveEditBucket: () => Promise<void>;
  handleCancelEditBucket: () => void;
  handleBucketDragStart: (index: number) => void;
  handleBucketDragOver: (e: React.DragEvent, index: number) => void;
  handleBucketDragEnd: () => Promise<void>;
  loadBuckets: (options?: { fetchFromSupabase?: boolean }) => Promise<void>;
  ensureUserOnboarded: () => void;
  debouncedSaveBucketsToSupabase: (ordered: string[]) => void;
}

export function useDashboardBuckets({
  user,
  authInitialized,
  pushUndo,
  setConfirmState,
  onBucketRemoved,
  onBucketRenamed,
  getWidgetSnapshot,
  restoreWidgets,
}: UseDashboardBucketsOptions): UseDashboardBucketsReturn {
  // ── State ──
  const [buckets, setBuckets] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('life_buckets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* fall through */ }
    return [];
  });
  const [activeBucket, setActiveBucket] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const savedActive = localStorage.getItem('active_bucket');
      const stored = localStorage.getItem('life_buckets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          return savedActive && parsed.includes(savedActive) ? savedActive : parsed[0];
        }
      }
    } catch { /* fall through */ }
    return '';
  });
  const [bucketsInitialized, setBucketsInitialized] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newBucket, setNewBucket] = useState("");
  const [bucketColors, setBucketColors] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('bucket_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch { /* fall through */ }
    return {};
  });
  const [editingBucketName, setEditingBucketName] = useState<string | null>(null);
  const [editingBucketNewName, setEditingBucketNewName] = useState("");
  const [draggedBucketIndex, setDraggedBucketIndex] = useState<number | null>(null);

  // ── Refs ──
  const bucketsRef = useRef<string[]>(buckets);
  const dragIndexRef = useRef<number | null>(null);
  const manageDragIndexRef = useRef<number | null>(null);

  // ── Sync ref ──
  useEffect(() => {
    bucketsRef.current = buckets;
  }, [buckets]);

  // ── Derived ──
  const getBucketColor = (bucket: string) => {
    return bucketColors[bucket] || '#B1916A';
  };

  const suggestedToShow = useMemo(
    () => SUGGESTED_BUCKETS.filter((name) => !buckets.includes(name)) as unknown as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buckets]
  );

  // ── Color change listener ──
  useEffect(() => {
    const handleBucketColorsChanged = () => {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('bucket_colors');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
              setBucketColors(parsed);
              return;
            }
          } catch (error) {
            console.warn('Failed to parse locally stored bucket_colors', error);
          }
        }
      }

      getUserPreferencesClient()
        .then(userPrefs => {
          if (userPrefs?.bucket_colors) {
            setBucketColors(userPrefs.bucket_colors);
          }
        })
        .catch(error => {
          console.error("Failed to reload bucket colors:", error);
        });
    };

    window.addEventListener('bucketColorsChanged', handleBucketColorsChanged);
    return () => window.removeEventListener('bucketColorsChanged', handleBucketColorsChanged);
  }, []);

  // ── Persist active bucket ──
  useEffect(() => {
    if (!activeBucket) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('active_bucket', activeBucket);
      } catch (e) {
        console.error('Failed to save active bucket to localStorage', e);
      }
    }
  }, [activeBucket]);

  // ── Debounced bucket order save ──
  const debouncedSaveBucketsToSupabase = useRef(
    debounce(async (ordered: string[]) => {
      try {
        const ok = await updateUserPreferenceFields({ life_buckets: ordered });
        if (ok) markBucketsSynced();
      } catch (err) {
        console.error('Failed to save bucket order to Supabase', err);
      }
    }, 1500)
  ).current;

  // ── CRUD handlers ──
  const handleAddBucket = useCallback(async () => {
    const name = newBucket.trim();
    if (!name || buckets.includes(name)) return;
    const updated = [...buckets, name];
    setBuckets(updated);
    if (!activeBucket) {
      setActiveBucket(name);
    }
    setNewBucket("");
    const existingColor = bucketColors[name];
    const colorToUse = existingColor || getSuggestedColorForBucket(name);
    if (!existingColor) {
      const nextColors = { ...bucketColors, [name]: colorToUse } as Record<string, string>;
      setBucketColors(nextColors);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
        window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }

    try {
      const mergedColors = { ...bucketColors, [name]: colorToUse } as Record<string, string>;
      const ok = await updateUserPreferenceFields({ life_buckets: updated, bucket_colors: mergedColors });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }
  }, [newBucket, buckets, activeBucket, bucketColors]);

  const handleAddBucketQuick = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || buckets.includes(trimmed)) return;
    const updated = [...buckets, trimmed];
    setBuckets(updated);
    if (!activeBucket) {
      setActiveBucket(trimmed);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    try {
      const existing = bucketColors[trimmed];
      const colorToUse = existing || getSuggestedColorForBucket(trimmed);
      const nextColors = { ...bucketColors, [trimmed]: colorToUse } as Record<string, string>;
      setBucketColors(() => ({ ...nextColors }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
        window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
      }
      const ok = await updateUserPreferenceFields({ life_buckets: updated, bucket_colors: nextColors });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }
  }, [buckets, activeBucket, bucketColors]);

  const handleRemoveBucketImmediate = useCallback(async (bucket: string) => {
    const updated = buckets.filter(b => b !== bucket);
    setBuckets(updated);
    if (activeBucket === bucket && updated.length) {
      setActiveBucket(updated[0]);
    } else if (!updated.length) {
      setActiveBucket('');
    }

    // Delegate widget/color cleanup to orchestrator
    const { cleanedWidgets, cleanedColors } = await onBucketRemoved(bucket);

    setBucketColors(cleanedColors);

    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      localStorage.setItem('bucket_colors', JSON.stringify(cleanedColors));
      localStorage.setItem('widgets_by_bucket', JSON.stringify({
        widgets: cleanedWidgets,
        savedAt: new Date().toISOString(),
      }));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }

    try {
      const ok = await updateUserPreferenceFields({
        life_buckets: updated,
        widgets_by_bucket: cleanedWidgets,
        bucket_colors: cleanedColors,
      });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }

    try {
      await fetch('/api/user/bucket-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket }),
      });
    } catch (err) {
      console.error('Failed to cascade-delete bucket data:', err);
    }
  }, [buckets, activeBucket, onBucketRemoved]);

  const requestRemoveBucket = useCallback((bucket: string) => {
    const previousBuckets = [...buckets];
    const previousActiveBucket = activeBucket;
    const previousColors = { ...bucketColors };
    const previousWidgets = getWidgetSnapshot();

    setIsEditorOpen(false);

    // Determine where widgets will be moved
    const remaining = buckets.filter(b => b !== bucket);
    const targetBucket = remaining.length > 0 ? remaining[0] : null;
    const bucketWidgetCount = (previousWidgets[bucket] ?? []).length;
    const hasWidgetsToMove = bucketWidgetCount > 0 && targetBucket;

    const description = hasWidgetsToMove
      ? `Tasks, calendar events, and shopping list items will be permanently deleted. ${bucketWidgetCount} widget${bucketWidgetCount > 1 ? 's' : ''} will be moved to "${targetBucket}".`
      : "This permanently removes the tab and all its data.";

    setConfirmState({
      title: `Remove "${bucket}" tab?`,
      description,
      confirmLabel: "Remove tab",
      onConfirm: async () => {
        await handleRemoveBucketImmediate(bucket);
        pushUndo(`Removed ${bucket} tab`, async () => {
          // Restore buckets
          setBuckets(previousBuckets);
          bucketsRef.current = previousBuckets;
          if (previousActiveBucket) {
            setActiveBucket(previousActiveBucket);
          } else if (previousBuckets.length > 0) {
            setActiveBucket(previousBuckets[0]);
          } else {
            setActiveBucket("");
          }
          // Restore colors
          setBucketColors(previousColors);
          // Restore widgets to their original state
          restoreWidgets(previousWidgets);

          if (typeof window !== "undefined") {
            localStorage.setItem("life_buckets", JSON.stringify(previousBuckets));
            localStorage.setItem("bucket_colors", JSON.stringify(previousColors));
            localStorage.setItem("widgets_by_bucket", JSON.stringify({
              widgets: previousWidgets,
              savedAt: new Date().toISOString(),
            }));
            markBucketsSaved();
            window.dispatchEvent(new CustomEvent("lifeBucketsChanged"));
            window.dispatchEvent(new CustomEvent("bucketColorsChanged"));
          }

          try {
            const ok = await updateUserPreferenceFields({
              life_buckets: previousBuckets,
              bucket_colors: previousColors,
              widgets_by_bucket: previousWidgets,
            });
            if (ok) markBucketsSynced();
          } catch (err) {
            console.error("Failed to restore bucket after undo:", err);
          }
        });
      },
    });
  }, [buckets, activeBucket, bucketColors, handleRemoveBucketImmediate, pushUndo, setConfirmState, getWidgetSnapshot, restoreWidgets]);

  const handleBucketColorChange = useCallback(async (bucket: string, colorHex: string) => {
    setBucketColors(prev => ({ ...prev, [bucket]: colorHex }));

    try {
      const nextColors = { ...bucketColors, [bucket]: colorHex } as Record<string, string>;
      await updateUserPreferenceFields({ bucket_colors: nextColors });
      if (typeof window !== 'undefined') {
        localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
        window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
      }
    } catch (err) {
      console.error('Failed to save bucket color to Supabase:', err);
    }
  }, [bucketColors]);

  const handleStartEditBucket = useCallback((bucket: string) => {
    setEditingBucketName(bucket);
    setEditingBucketNewName(bucket);
  }, []);

  const handleSaveEditBucket = useCallback(async () => {
    if (!editingBucketName || !editingBucketNewName.trim()) {
      setEditingBucketName(null);
      setEditingBucketNewName("");
      return;
    }

    const newName = editingBucketNewName.trim();
    if (newName === editingBucketName) {
      setEditingBucketName(null);
      setEditingBucketNewName("");
      return;
    }

    if (buckets.includes(newName)) {
      alert('A tab with this name already exists');
      return;
    }

    const updated = buckets.map(b => b === editingBucketName ? newName : b);
    setBuckets(updated);

    if (activeBucket === editingBucketName) {
      setActiveBucket(newName);
    }

    const oldColor = bucketColors[editingBucketName];
    const updatedColors = { ...bucketColors };
    if (oldColor) {
      delete updatedColors[editingBucketName];
      updatedColors[newName] = oldColor;
      setBucketColors(updatedColors);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      localStorage.setItem('bucket_colors', JSON.stringify(updatedColors));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
      window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
    }

    // Delegate widget key migration to orchestrator
    onBucketRenamed(editingBucketName, newName);

    try {
      const ok = await updateUserPreferenceFields({ life_buckets: updated, bucket_colors: updatedColors });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save bucket rename to Supabase:', err);
    }

    setEditingBucketName(null);
    setEditingBucketNewName("");
  }, [editingBucketName, editingBucketNewName, buckets, activeBucket, bucketColors, onBucketRenamed]);

  const handleCancelEditBucket = useCallback(() => {
    setEditingBucketName(null);
    setEditingBucketNewName("");
  }, []);

  // ── Drag handlers ──
  const handleBucketDragStart = useCallback((index: number) => {
    manageDragIndexRef.current = index;
    setDraggedBucketIndex(index);
  }, []);

  const handleBucketDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const currentIndex = manageDragIndexRef.current;
    if (currentIndex === null || currentIndex === index) return;

    setBuckets((prev) => {
      if (currentIndex < 0 || currentIndex >= prev.length) {
        return prev;
      }
      const updated = [...prev];
      const [draggedBucket] = updated.splice(currentIndex, 1);
      updated.splice(index, 0, draggedBucket);
      manageDragIndexRef.current = index;
      bucketsRef.current = updated;
      return updated;
    });
    setDraggedBucketIndex(index);
  }, []);

  const handleBucketDragEnd = useCallback(async () => {
    if (manageDragIndexRef.current === null) return;

    manageDragIndexRef.current = null;
    setDraggedBucketIndex(null);

    const latestBuckets = bucketsRef.current.length ? bucketsRef.current : buckets;

    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(latestBuckets));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    try {
      const ok = await updateUserPreferenceFields({ life_buckets: latestBuckets });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save bucket order to Supabase:', err);
    }
  }, [buckets]);

  // ── loadBuckets ──
  const loadBuckets = useCallback(async (options?: { fetchFromSupabase?: boolean }) => {
    const shouldFetchFromSupabase = options?.fetchFromSupabase ?? true;
    let loadedFromLocal = false;
    let localBuckets: string[] = [];
    let localBucketColors: Record<string, string> | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('life_buckets');
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) {
            localBuckets = parsed;
            bucketsRef.current = parsed;
            setBuckets(parsed);
            const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
            setActiveBucket(savedActive && parsed.includes(savedActive) ? savedActive : parsed[0]);
            loadedFromLocal = true;
            const storedColors = localStorage.getItem('bucket_colors');
            if (storedColors) {
              try {
                const parsedColors = JSON.parse(storedColors);
                if (parsedColors && typeof parsedColors === 'object') {
                  localBucketColors = parsedColors;
                  setBucketColors(parsedColors);
                }
              } catch (e) {
                console.warn('Failed to parse local bucket_colors');
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse stored buckets', e);
      }
    }

    try {
      if (!shouldFetchFromSupabase) {
        return;
      }

      const prefs = await getUserPreferencesClient();
      const serverBuckets = prefs?.life_buckets ?? [];
      const hasServer = serverBuckets.length > 0;
      const hasLocal = loadedFromLocal && localBuckets.length > 0;
      const unsynced = hasUnsyncedBucketChanges();

      if (hasLocal && unsynced) {
        bucketsRef.current = localBuckets;
        setBuckets(localBuckets);
        const active = (typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null) || localBuckets[0];
        setActiveBucket(localBuckets.includes(active || '') ? (active as string) : localBuckets[0]);
        if (localBucketColors) setBucketColors(localBucketColors);
        const mergedColors = { ...(prefs?.bucket_colors || {}), ...(localBucketColors || {}) } as Record<string, string>;
        void updateUserPreferenceFields({ life_buckets: localBuckets, bucket_colors: mergedColors }).then((ok) => {
          if (ok) markBucketsSynced();
        });
      } else if (hasServer) {
        bucketsRef.current = serverBuckets;
        setBuckets(serverBuckets);
        if (typeof window !== 'undefined') {
          localStorage.setItem('life_buckets', JSON.stringify(serverBuckets));
        }
        const localSaved = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
        const initialActive = localSaved && serverBuckets.includes(localSaved) ? localSaved : serverBuckets[0];
        setActiveBucket(initialActive);
        const serverColors = prefs?.bucket_colors || {};
        if (Object.keys(serverColors).length > 0) {
          setBucketColors(serverColors);
          if (typeof window !== 'undefined') {
            localStorage.setItem('bucket_colors', JSON.stringify(serverColors));
          }
        }
        markBucketsSaved();
        markBucketsSynced();
      } else if (hasLocal) {
        bucketsRef.current = localBuckets;
        if (localBucketColors) setBucketColors(localBucketColors);
        const mergedColors = { ...(localBucketColors || {}) } as Record<string, string>;
        void updateUserPreferenceFields({ life_buckets: localBuckets, bucket_colors: mergedColors }).then((ok) => {
          if (ok) markBucketsSynced();
        });
      } else {
        bucketsRef.current = [];
        setBuckets([]);
        setBucketColors({});
        setActiveBucket('');
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
    } finally {
      setBucketsInitialized(true);
    }
  }, []);

  // ── ensureUserOnboarded ──
  const ensureUserOnboarded = useCallback(() => {
    void (async () => {
      try {
        if (typeof window !== 'undefined' && localStorage.getItem('lifeboard:onboarded') === '1') {
          return;
        }

        const cachedUser = await getCachedUser();
        if (!cachedUser) return;

        const [profileRes, prefs] = await Promise.all([
          fetch('/api/user/profile', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null),
          getUserPreferencesClient(),
        ]);

        const profile = profileRes?.profile;
        if (profile?.onboarded === true) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lifeboard:onboarded', '1');
          }
          return;
        }
        if (prefs?.life_buckets?.length && profile && profile.onboarded === false) {
          await fetch('/api/user/profile', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ onboarded: true }),
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('lifeboard:onboarded', '1');
          }
        }
      } catch (err) {
        console.error('Error in ensureUserOnboarded:', err);
      }
    })();
  }, []);

  return {
    buckets,
    setBuckets,
    activeBucket,
    setActiveBucket,
    bucketsInitialized,
    setBucketsInitialized,
    bucketColors,
    setBucketColors,
    bucketsRef,
    isEditorOpen,
    setIsEditorOpen,
    newBucket,
    setNewBucket,
    editingBucketName,
    setEditingBucketName,
    editingBucketNewName,
    setEditingBucketNewName,
    draggedBucketIndex,
    dragIndexRef,
    manageDragIndexRef,
    suggestedToShow,
    getBucketColor,
    handleAddBucket,
    handleAddBucketQuick,
    requestRemoveBucket,
    handleBucketColorChange,
    handleStartEditBucket,
    handleSaveEditBucket,
    handleCancelEditBucket,
    handleBucketDragStart,
    handleBucketDragOver,
    handleBucketDragEnd,
    loadBuckets,
    ensureUserOnboarded,
    debouncedSaveBucketsToSupabase,
  };
}
