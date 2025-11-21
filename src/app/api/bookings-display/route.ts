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

  const { data, error } = await supabase
    .from('bookings')
    .select('*, profile:profiles(*)')
    .eq('simulator', simulator)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[Display API] Error fetching bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
