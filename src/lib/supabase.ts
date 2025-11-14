import { createBrowserClient } from "@supabase/ssr";

// Custom storage adapter that checks both localStorage and sessionStorage
// This allows sessions to work regardless of where they were stored during login
const createDualStorage = () => {
  if (typeof window === 'undefined') return undefined;

  return {
    getItem: (key: string) => {
      // Check sessionStorage first, then localStorage
      return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
      // Write to localStorage by default (can be overridden during login)
      window.localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
      // Remove from both to ensure cleanup
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    },
  };
};

export function createClient(useSessionStorage?: boolean) {
  // Hardcoded values - Next.js 16.0.1 with Turbopack isn't replacing process.env in browser
  const supabaseUrl = "https://uxtdsiqlzhzrwqyozuho.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dGRzaXFsemh6cndxeW96dWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NTQ0MjksImV4cCI6MjA3ODIzMDQyOX0.jsXukhV2ApAv1cay_59nChhoq8XQmcfJDXlYLamLHGE";

  // Determine which storage to use
  let storage;
  if (typeof window !== 'undefined') {
    if (useSessionStorage === true) {
      // Explicitly use sessionStorage (for "Remember Me" unchecked during login)
      storage = window.sessionStorage;
    } else if (useSessionStorage === false) {
      // Explicitly use localStorage (for "Remember Me" checked during login)
      storage = window.localStorage;
    } else {
      // Auto-detect: check both storages (for all other pages)
      storage = createDualStorage();
    }
  }

  const options = {
    auth: {
      storage,
      storageKey: 'supabase.auth.token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Force session refresh on mobile when app resumes
      flowType: 'pkce' as const,
    }
  };

  return createBrowserClient(supabaseUrl, supabaseAnonKey, options);
}
