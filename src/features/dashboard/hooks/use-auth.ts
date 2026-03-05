"use client";

import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";
import { getCachedUser } from "@/lib/user-preferences";
import { clearAllUserCaches, ensureCacheOwner } from "@/lib/auth-cleanup";
import { getPrefetchedGreetingName } from "@/lib/prefetch-user-prefs";
import { type ProfileNameRow, deriveGreetingName } from "@/lib/dashboard-utils";

interface UseAuthOptions {
  onBeforeSignOut?: () => void;
}

interface UseAuthReturn {
  user: User | null;
  greetingName: string;
  authInitialized: boolean;
  isSigningOut: boolean;
  handleSignOut: () => Promise<void>;
}

export function useAuth({ onBeforeSignOut }: UseAuthOptions = {}): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [greetingName, setGreetingName] = useState<string>("");
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Auth state change listener — uses deduplicating cached helper so
  // preferences can share the same auth round-trip instead of re-fetching.
  useEffect(() => {
    getCachedUser().then((resolvedUser) => {
      if (resolvedUser) ensureCacheOwner(resolvedUser.id);
      setUser(resolvedUser);
      setAuthInitialized(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearAllUserCaches();
      if (session?.user) ensureCacheOwner(session.user.id);
      setUser(session?.user ?? null);
      setAuthInitialized(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Greeting name fetch
  useEffect(() => {
    let isCancelled = false;

    const fetchGreetingName = async () => {
      if (!user) {
        if (!isCancelled) {
          setGreetingName("");
        }
        return;
      }

      // Try prefetched greeting name first (started at module eval time)
      try {
        const prefetched = await getPrefetchedGreetingName();
        if (!isCancelled && prefetched) {
          setGreetingName(deriveGreetingName({ first_name: prefetched } as ProfileNameRow, user));
          return;
        }
      } catch { /* fall through to direct query */ }

      try {
        const res = await fetch('/api/user/profile', { credentials: 'same-origin' });
        if (isCancelled) return;

        if (res.ok) {
          const { profile } = await res.json();
          setGreetingName(deriveGreetingName(profile ?? null, user));
        } else {
          console.error('Failed to load profile for greeting');
          setGreetingName(deriveGreetingName(null, user));
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('Failed to resolve greeting name', err);
        setGreetingName(deriveGreetingName(null, user));
      }
    };

    fetchGreetingName();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return; // Prevent double-clicks
    setIsSigningOut(true);

    try {
      // Flush any pending debounced saves before logging out
      onBeforeSignOut?.();

      // Purge all client-side caches BEFORE the network call so stale data
      // cannot survive if the page navigates before SIGNED_OUT fires.
      clearAllUserCaches();

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      window.location.href = '/';

    } catch (error) {
      console.error('Client: Error during sign out:', error);
      setIsSigningOut(false); // Re-enable button on error
    }
  }, [isSigningOut, onBeforeSignOut]);

  return { user, greetingName, authInitialized, isSigningOut, handleSignOut };
}
