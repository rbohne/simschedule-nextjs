import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { Simulator } from '@/types/database'

// GET - Get bookings for a specific day and simulator
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const simulator = searchParams.get('simulator') as Simulator
  const date = searchParams.get('date')

  if (!simulator || !date) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST - Create a new booking
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[Booking API] Auth check:', {
    userId: user?.id,
    email: user?.email,
    hasAuthError: !!authError,
    authError: authError?.message
  })

  if (!user) {
    console.log('[Booking API] No user found - unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { simulator, start_time } = body

  console.log('[Booking API] Request params:', { simulator, start_time, userId: user.id })

  if (!simulator || !start_time) {
    console.log('[Booking API] Missing parameters')
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Check total booked hours (2 hour limit)
  const now = new Date().toISOString()
  const { data: existingBookings, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user.id)
    .gte('end_time', now)

  console.log('[Booking API] Existing bookings check:', {
    count: existingBookings?.length,
    hasError: !!fetchError,
    error: fetchError?.message
  })

  if (existingBookings && existingBookings.length >= 2) {
    console.log('[Booking API] User has reached 2 hour limit')
    return NextResponse.json({
      error: 'You already have 2 hours booked. Please cancel a booking first.'
    }, { status: 400 })
  }

  // Create booking
  const startTime = new Date(start_time)
  const endTime = new Date(startTime)
  endTime.setHours(endTime.getHours() + 1)

  console.log('[Booking API] Attempting to insert booking:', {
    user_id: user.id,
    simulator,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString()
  })

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: user.id,
      simulator,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[Booking API] Insert failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    return NextResponse.json({
      error: error.message,
      details: error.details,
      hint: error.hint
    }, { status: 500 })
  }

  console.log('[Booking API] Booking created successfully:', data)
  return NextResponse.json(data)
}

// DELETE - Cancel a booking
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('id')

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // If admin, use admin client to bypass RLS and delete any booking
  // Otherwise, use regular client which will be restricted by RLS to only delete own bookings
  const clientToUse = isAdmin ? createAdminSupabaseClient() : supabase

  const { error } = await clientToUse
    .from('bookings')
    .delete()
    .eq('id', parseInt(bookingId))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
