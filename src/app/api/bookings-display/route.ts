import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { Simulator } from '@/types/database'

// Public GET endpoint for display monitors - uses admin client to bypass RLS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const simulator = searchParams.get('simulator') as Simulator
  const date = searchParams.get('date')

  if (!simulator || !date) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Use admin client to bypass RLS for public display
  const supabase = createAdminSupabaseClient()

  // The date parameter is in MST (e.g., 2025-11-21T07:00:00.000Z represents midnight MST)
  // We need to convert MST day boundaries to UTC for the database query
  // MST is UTC-7, so midnight MST = 7:00 UTC same day
  // and 11:59:59 PM MST = 6:59:59 UTC next day
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  // Add 7 hours to get UTC time for midnight MST
  const startOfDayUTC = new Date(startOfDay.getTime() + (7 * 3600000))

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  // Add 7 hours to get UTC time for end of day MST
  const endOfDayUTC = new Date(endOfDay.getTime() + (7 * 3600000))

  console.log('[Display API] Querying with UTC times:', {
    startOfDayUTC: startOfDayUTC.toISOString(),
    endOfDayUTC: endOfDayUTC.toISOString(),
  })

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('simulator', simulator)
    .gte('start_time', startOfDayUTC.toISOString())
    .lte('start_time', endOfDayUTC.toISOString())
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[Display API] Error fetching bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[Display API] Found ${bookings?.length || 0} bookings for ${simulator} on ${date}`)

  // Fetch profiles for the bookings
  if (bookings && bookings.length > 0) {
    const userIds = [...new Set(bookings.map((b: any) => b.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    console.log(`[Display API] Fetched ${profiles?.length || 0} profiles for bookings`)

    // Attach profiles to bookings
    const bookingsWithProfiles = bookings.map((booking: any) => ({
      ...booking,
      profile: profiles?.find((p) => p.id === booking.user_id),
    }))

    return NextResponse.json(bookingsWithProfiles)
  }

  return NextResponse.json(bookings || [])
}
