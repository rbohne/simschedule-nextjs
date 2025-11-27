import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { Simulator } from '@/types/database'
import { sendBookingConfirmation } from '@/lib/email'

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

  // Include bookings from today 00:00 through tomorrow 02:00 (for midnight-2am slots)
  const endOfDay = new Date(date)
  endOfDay.setDate(endOfDay.getDate() + 1) // Move to next day
  endOfDay.setHours(2, 0, 0, 0) // 2:00 AM next day

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
  const supabase = await createServerSupabaseClient(request)

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
  // Skip booking limit check if:
  // 1. The person making the booking is an admin (can book unlimited for anyone)
  // 2. OR the target user is an admin (admins can have unlimited bookings)
  if (!isAdmin) {
    // Only check limits if a regular user is booking for themselves
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
      console.log('[Booking API] User has reached 1 booking limit')
      return NextResponse.json({
        error: 'You already have a booking (2 hours). Please cancel it first to book a different time.'
      }, { status: 400 })
    }
  } else {
    console.log('[Booking API] Admin user - skipping booking limit check (can book unlimited for anyone)')
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

  // Get user details for email
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', bookingUserId)
    .single()

  // Send confirmation email
  if (userProfile?.email) {
    try {
      await sendBookingConfirmation({
        userEmail: userProfile.email,
        userName: userProfile.name || 'User',
        simulator,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })
    } catch (err) {
      console.error('[Booking API] Failed to send email:', err)
      // Don't fail the booking if email fails
    }
  }

  return NextResponse.json(data)
}

// DELETE - Cancel a booking
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient(request)

  console.log('[Booking API DELETE] Starting cancellation request')

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[Booking API DELETE] Auth check:', {
    userId: user?.id,
    email: user?.email,
    hasAuthError: !!authError,
    authError: authError?.message
  })

  if (!user) {
    console.log('[Booking API DELETE] No user found - unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('id')

  console.log('[Booking API DELETE] Request params:', { bookingId, userId: user.id })

  if (!bookingId) {
    console.log('[Booking API DELETE] Missing booking ID')
    return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  console.log('[Booking API DELETE] User profile check:', {
    userId: user.id,
    isAdmin,
    role: profile?.role
  })

  console.log('[Booking API DELETE] Attempting to delete booking:', {
    bookingId: parseInt(bookingId),
    usingAdminClient: isAdmin
  })

  // IMPORTANT: Always use admin client for deleting transactions to bypass RLS
  // Regular users can't delete transactions due to RLS policies, even their own
  const adminClient = createAdminSupabaseClient()

  // First, delete all guest fee transactions associated with this booking
  console.log('[Booking API DELETE] Deleting associated guest fee transactions...')
  const { data: deletedTransactions, error: transactionError } = await adminClient
    .from('user_transactions')
    .delete()
    .eq('booking_id', parseInt(bookingId))
    .eq('type', 'guest_fee')
    .select()

  if (transactionError) {
    console.error('[Booking API DELETE] Failed to delete guest fee transactions:', {
      message: transactionError.message,
      details: transactionError.details,
      hint: transactionError.hint,
      code: transactionError.code
    })
    return NextResponse.json({ error: `Failed to delete guest fees: ${transactionError.message}` }, { status: 500 })
  }

  console.log('[Booking API DELETE] Deleted guest fee transactions:', {
    count: deletedTransactions?.length || 0,
    transactionIds: deletedTransactions?.map(t => t.id) || []
  })

  // If admin, use admin client to bypass RLS and delete any booking
  // Otherwise, use regular client which will be restricted by RLS to only delete own bookings
  const clientToUse = isAdmin ? adminClient : supabase

  // Now delete the booking itself
  const { error } = await clientToUse
    .from('bookings')
    .delete()
    .eq('id', parseInt(bookingId))

  if (error) {
    console.error('[Booking API DELETE] Delete failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[Booking API DELETE] Booking deleted successfully')
  return NextResponse.json({
    success: true,
    deletedGuestFees: deletedTransactions?.length || 0
  })
}
