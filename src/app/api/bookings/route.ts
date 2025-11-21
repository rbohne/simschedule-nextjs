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
  const { simulator, start_time, targetUserId } = body

  console.log('[Booking API] Request params:', { simulator, start_time, userId: user.id, targetUserId })

  if (!simulator || !start_time) {
    console.log('[Booking API] Missing parameters')
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  console.log('[Booking API] User profile check:', {
    userId: user.id,
    isAdmin
  })

  // If targetUserId is provided, only admins can use it
  if (targetUserId && !isAdmin) {
    console.log('[Booking API] Non-admin user attempted to book for another user')
    return NextResponse.json({ error: 'Unauthorized: Only admins can book for other users' }, { status: 403 })
  }

  // Determine which user the booking is for
  const bookingUserId = targetUserId || user.id

  // Check if target user exists (if booking for another user)
  if (targetUserId) {
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', targetUserId)
      .single()

    if (!targetUser) {
      console.log('[Booking API] Target user not found:', targetUserId)
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    console.log('[Booking API] Booking for target user:', {
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      targetUserRole: targetUser.role
    })
  }

  // Check total booked bookings (1 booking limit for regular users, unlimited for admins)
  // Each booking is 2 hours
  // Check booking limits for the user who will have the booking
  const { data: targetUserProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', bookingUserId)
    .single()

  const isTargetUserAdmin = targetUserProfile?.role === 'admin'

  if (!isTargetUserAdmin) {
    const now = new Date().toISOString()
    const { data: existingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', bookingUserId)
      .gte('end_time', now)

    console.log('[Booking API] Existing bookings check:', {
      bookingUserId,
      count: existingBookings?.length,
      hasError: !!fetchError,
      error: fetchError?.message
    })

    if (existingBookings && existingBookings.length >= 1) {
      const userName = targetUserId ? 'This user' : 'You'
      console.log('[Booking API] User has reached 1 booking limit')
      return NextResponse.json({
        error: `${userName} already ha${targetUserId ? 's' : 've'} a booking (2 hours). Please cancel it first to book a different time.`
      }, { status: 400 })
    }
  } else {
    console.log('[Booking API] Target user is admin - skipping booking limit check')
  }

  // Create booking - each booking is 2 hours
  const startTime = new Date(start_time)
  const endTime = new Date(startTime)
  endTime.setHours(endTime.getHours() + 2) // Changed from 1 to 2 hours

  console.log('[Booking API] Attempting to insert booking:', {
    user_id: bookingUserId,
    simulator,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    bookedByAdmin: targetUserId ? user.id : null
  })

  // If booking for another user, use admin client to bypass RLS
  const clientToUse = targetUserId ? createAdminSupabaseClient() : supabase

  const { data, error } = await clientToUse
    .from('bookings')
    .insert({
      user_id: bookingUserId,
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
