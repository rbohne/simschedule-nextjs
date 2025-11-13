import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET - Get all transactions or user balance
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const action = searchParams.get('action')

  // Allow users to fetch their own transactions
  if (userId && userId !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden - Can only view your own transactions' }, { status: 403 })
  }

  // Only admins can view balances for all users
  if (action === 'balances' && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  // Get user balances (sum of all transactions grouped by user)
  if (action === 'balances') {
    const adminClient = createAdminSupabaseClient()

    // Get all transactions
    const { data: transactions, error: transError } = await adminClient
      .from('user_transactions')
      .select('user_id, amount')

    if (transError) {
      return NextResponse.json({ error: transError.message }, { status: 500 })
    }

    // Calculate balances per user
    const balances: { [key: string]: number } = {}
    transactions?.forEach((trans) => {
      if (!balances[trans.user_id]) {
        balances[trans.user_id] = 0
      }
      balances[trans.user_id] += parseFloat(trans.amount.toString())
    })

    // Get user profiles for users with non-zero balances
    const userIds = Object.keys(balances).filter(id => balances[id] > 0)
    if (userIds.length === 0) {
      return NextResponse.json([])
    }

    const { data: profiles } = await adminClient
      .from('profiles')
      .select('*')
      .in('id', userIds)

    const result = profiles?.map(profile => ({
      ...profile,
      balance: balances[profile.id] || 0
    })) || []

    return NextResponse.json(result)
  }

  // Get transactions for a specific user
  if (userId) {
    const adminClient = createAdminSupabaseClient()
    const { data: transactions, error } = await adminClient
      .from('user_transactions')
      .select('*, booking:bookings(start_time, simulator)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(transactions)
  }

  return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
}

// POST - Add a guest fee or payment
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const body = await request.json()
  const { userId, bookingId, type, amount, description } = body

  if (!userId || !type || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Allow users to add guest fees for their own bookings
  // Only admins can add fees for other users or non-guest-fee types
  if (!isAdmin) {
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden - Can only add fees to your own bookings' }, { status: 403 })
    }
    if (type !== 'guest_fee') {
      return NextResponse.json({ error: 'Forbidden - Users can only add guest fees' }, { status: 403 })
    }
  }

  const adminClient = createAdminSupabaseClient()

  const { data, error } = await adminClient
    .from('user_transactions')
    .insert({
      user_id: userId,
      booking_id: bookingId || null,
      type,
      amount,
      description,
      created_by: user.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE - Remove a transaction (guest fee)
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const transactionId = searchParams.get('id')

  if (!transactionId) {
    return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 })
  }

  const adminClient = createAdminSupabaseClient()

  // Get the transaction to check ownership
  const { data: transaction } = await adminClient
    .from('user_transactions')
    .select('user_id, type')
    .eq('id', transactionId)
    .single()

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Users can only delete their own guest fees, admins can delete anything
  if (!isAdmin && transaction.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden - Can only delete your own transactions' }, { status: 403 })
  }

  if (!isAdmin && transaction.type !== 'guest_fee') {
    return NextResponse.json({ error: 'Forbidden - Users can only delete guest fees' }, { status: 403 })
  }

  const { error } = await adminClient
    .from('user_transactions')
    .delete()
    .eq('id', transactionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
