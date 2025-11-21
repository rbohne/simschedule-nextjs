import { createClient } from '@supabase/supabase-js'

export async function createServerSupabaseClient(request?: Request) {
  let authorization: string | null = null

  console.log('[Server Auth] createServerSupabaseClient called, request provided:', !!request)

  // Try to get Authorization header from request object if provided
  if (request) {
    authorization = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('[Server Auth] Got auth from Request object:', authorization ? 'Present' : 'Missing')
    if (!authorization) {
      console.log('[Server Auth] All request headers:', Array.from(request.headers.entries()).map(([k,v]) => k).join(', '))
    }
  } else {
    // Fallback to Next.js headers() if no request provided
    try {
      const { headers } = await import('next/headers')
      const headersList = await headers()
      authorization = headersList.get('authorization') || headersList.get('Authorization')
      console.log('[Server Auth] Got auth from headers():', authorization ? 'Present' : 'Missing')
    } catch (e) {
      console.log('[Server Auth] Could not access headers()')
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: authorization ? {
          Authorization: authorization
        } : {}
      }
    }
  )

  // If we have an authorization header, set the session
  if (authorization) {
    const token = authorization.replace('Bearer ', '').trim()
    console.log('[Server Auth] Setting session with token (length:', token.length, ')')
    try {
      const result = await supabase.auth.setSession({
        access_token: token,
        refresh_token: '' // Not needed for API route context
      })

      if (result.error) {
        console.error('[Server Auth] Failed to set session:', result.error.message)
      } else {
        console.log('[Server Auth] Session set successfully')
      }
    } catch (e: any) {
      console.error('[Server Auth] Exception setting session:', e.message)
    }
  }

  return supabase
}

// Admin client with service role key for admin operations
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
