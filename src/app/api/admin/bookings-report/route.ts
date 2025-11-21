import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient(request)

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get date range from query parameters
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 })
  }

  console.log('[Bookings Report] Fetching bookings from', startDate, 'to', endDate)

  // Use admin client to bypass RLS and fetch all bookings
  const adminClient = createAdminSupabaseClient()
  const { data: bookings, error } = await adminClient
    .from('bookings')
    .select('*')
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time', { ascending: false })

  console.log('[Bookings Report] Result:', {
    count: bookings?.length,
    hasError: !!error,
    error: error?.message
  })

  if (error) {
    console.error('[Bookings Report] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch profiles separately since there's no foreign key relationship
  const userIds = [...new Set(bookings?.map(b => b.user_id) || [])]
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('*')
    .in('id', userIds)

  // Map profiles to bookings
  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
  const bookingsWithProfiles = bookings?.map(booking => ({
    ...booking,
    profile: profileMap.get(booking.user_id) || null
  })) || []

  return NextResponse.json(bookingsWithProfiles)
}
