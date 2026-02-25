import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Hardcoded values - Next.js 16.0.1 with Turbopack isn't replacing process.env in browser
export const supabaseUrl = "https://uxtdsiqlzhzrwqyozuho.supabase.co";
export const supabaseAnonKey = "sb_publishable_gPV9pjTLd4XqgnmGxk7aTw_Ylne86n8";

// Storage key used by Supabase auth client
const AUTH_STORAGE_KEY = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;

/**
 * Reads the current auth session directly from browser storage.
 * This bypasses the Supabase client's initializePromise, which can block for
 * up to 30 seconds when a token refresh fails. Use this for immediate auth
 * checks that must not block on network activity.
 */
export function getStoredSession(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY) ||
                window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Extend window to store the global singleton
declare global {
  interface Window {
    __supabaseClient?: SupabaseClient;
  }
}

export function createClient(useSessionStorage?: boolean) {
  // Check for existing client on window object (true global singleton)
  if (typeof window !== 'undefined' && window.__supabaseClient) {
    // Only create a new instance if we're explicitly setting storage type during login
    if (useSessionStorage !== undefined) {
      // User is logging in with a specific storage preference
      // Clear old singleton and create new one
      window.__supabaseClient = undefined;
    } else {
      // Normal usage - return existing global client
      return window.__supabaseClient;
    }
  }

  // Determine which storage to use based on Remember Me preference
  const getStorageToUse = () => {
    if (typeof window === 'undefined') return undefined;

    if (useSessionStorage === true) {
      // "Remember Me" unchecked - use sessionStorage (clears when browser closes)
      return window.sessionStorage;
    } else if (useSessionStorage === false) {
      // "Remember Me" checked - use localStorage (persists)
      return window.localStorage;
    } else {
      // Auto-detect: check sessionStorage first, then localStorage
      // This handles reading sessions regardless of where they were saved
      try {
        const sessionKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
        const sessionToken = window.sessionStorage.getItem(sessionKey);
        if (sessionToken) {
          return window.sessionStorage;
        }
        // Also check localStorage
        const localToken = window.localStorage.getItem(sessionKey);
        if (localToken) {
          return window.localStorage;
        }
      } catch (e) {
        // Ignore errors
      }
      // Default to localStorage if no tokens found
      return window.localStorage;
    }
  };

  // Create a new client
  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: getStorageToUse(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    }
  });

  // Store as global singleton on window
  if (typeof window !== 'undefined') {
    window.__supabaseClient = client;
  }

  return client;
}
