import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

export function createClient(useSessionStorage?: boolean) {
  // Hardcoded values - Next.js 16.0.1 with Turbopack isn't replacing process.env in browser
  const supabaseUrl = "https://uxtdsiqlzhzrwqyozuho.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dGRzaXFsemh6cndxeW96dWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NTQ0MjksImV4cCI6MjA3ODIzMDQyOX0.jsXukhV2ApAv1cay_59nChhoq8XQmcfJDXlYLamLHGE";

  // Determine which storage to use based on Remember Me preference
  // Auto-detect from both storages if not specified
  const getStorageToUse = () => {
    if (typeof window === 'undefined') return undefined;

    if (useSessionStorage === true) {
      // "Remember Me" unchecked - use sessionStorage
      return window.sessionStorage;
    } else if (useSessionStorage === false) {
      // "Remember Me" checked - use localStorage
      return window.localStorage;
    } else {
      // Auto-detect: try sessionStorage first, then localStorage
      // This handles reading sessions regardless of where they were saved
      const sessionToken = window.sessionStorage.getItem('supabase.auth.token');
      if (sessionToken) {
        return window.sessionStorage;
      }
      return window.localStorage;
    }
  };

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        if (typeof document === 'undefined') return undefined;

        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [key, value] = cookie.trim().split('=');
          if (key === name) {
            return decodeURIComponent(value);
          }
        }
        return undefined;
      },
      set(name: string, value: string, options: CookieOptions) {
        if (typeof document === 'undefined') return;

        let cookie = `${name}=${encodeURIComponent(value)}`;

        if (options.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }
        if (options.path) {
          cookie += `; path=${options.path}`;
        }
        if (options.domain) {
          cookie += `; domain=${options.domain}`;
        }
        if (options.sameSite) {
          cookie += `; samesite=${options.sameSite}`;
        }
        if (options.secure) {
          cookie += '; secure';
        }

        document.cookie = cookie;
      },
      remove(name: string, options: CookieOptions) {
        if (typeof document === 'undefined') return;

        let cookie = `${name}=; max-age=0`;
        if (options.path) {
          cookie += `; path=${options.path}`;
        }
        if (options.domain) {
          cookie += `; domain=${options.domain}`;
        }

        document.cookie = cookie;
      },
    },
    auth: {
      storage: getStorageToUse(),
      storageKey: 'supabase.auth.token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce' as const,
    }
  });
}
