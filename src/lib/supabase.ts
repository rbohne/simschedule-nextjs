import { createBrowserClient } from "@supabase/ssr";

export function createClient(useSessionStorage = false) {
  // Hardcoded values - Next.js 16.0.1 with Turbopack isn't replacing process.env in browser
  const supabaseUrl = "https://uxtdsiqlzhzrwqyozuho.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dGRzaXFsemh6cndxeW96dWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NTQ0MjksImV4cCI6MjA3ODIzMDQyOX0.jsXukhV2ApAv1cay_59nChhoq8XQmcfJDXlYLamLHGE";

  // Always configure storage explicitly for better mobile support
  const options = {
    auth: {
      storage: typeof window !== 'undefined'
        ? (useSessionStorage ? window.sessionStorage : window.localStorage)
        : undefined,
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
