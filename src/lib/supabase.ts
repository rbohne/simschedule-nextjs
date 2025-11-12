import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Hardcoded values - Next.js 16.0.1 with Turbopack isn't replacing process.env in browser
  const supabaseUrl = "https://uxtdsiqlzhzrwqyozuho.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dGRzaXFsemh6cndxeW96dWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NTQ0MjksImV4cCI6MjA3ODIzMDQyOX0.jsXukhV2ApAv1cay_59nChhoq8XQmcfJDXlYLamLHGE";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
