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

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('simulator', simulator)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[Display API] Error fetching bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch profiles for the bookings
  if (bookings && bookings.length > 0) {
    const userIds = [...new Set(bookings.map((b: any) => b.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    // Attach profiles to bookings
    const bookingsWithProfiles = bookings.map((booking: any) => ({
      ...booking,
      profile: profiles?.find((p) => p.id === booking.user_id),
    }))

    return NextResponse.json(bookingsWithProfiles)
  }

  return NextResponse.json(bookings)
}
