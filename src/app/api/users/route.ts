import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET - Get all users (admin only)
export async function GET(request: Request) {
  console.log('[API/Users] GET request received')
  console.log('[API/Users] Authorization header:', request.headers.get('authorization') ? 'Present' : 'Missing')
  console.log('[API/Users] All headers:', Array.from(request.headers.entries()).map(([k,v]) => `${k}: ${v.substring(0, 50)}`))
  const supabase = await createServerSupabaseClient(request)

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[API/Users] User from getUser():', user ? user.id : 'None')
  if (!user) {
    console.log('[API/Users] No user - returning 401')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  // Get all profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(profiles)
}

// POST - Create a new user (admin only)
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient(request)

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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, name, phone, role } = body

  if (!email || !password || !name || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Create admin client for user creation
  const adminClient = createAdminSupabaseClient()

  // Create user in Supabase Auth
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      name,
      phone
    }
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Calculate active_until date (1 year from today)
  const activeUntil = new Date()
  activeUntil.setFullYear(activeUntil.getFullYear() + 1)

  // Update profile with additional info using admin client
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      name,
      phone,
      role: role || 'user',
      active_until: activeUntil.toISOString()
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, user: newUser.user })
}

// PUT - Update a user (admin only)
export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient(request)

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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { userId, email, name, phone, role, profile_picture_url, active_until } = body

  if (!userId || !email || !name || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Create admin client for user update
  const adminClient = createAdminSupabaseClient()

  // Update user email in Supabase Auth if changed
  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
    userId,
    {
      email,
      user_metadata: {
        name,
        phone
      }
    }
  )

  if (updateAuthError) {
    return NextResponse.json({ error: updateAuthError.message }, { status: 500 })
  }

  // Update profile
  const updateData: any = {
    email,
    name,
    phone,
    role: role || 'user'
  }

  // Only update profile_picture_url if it's provided
  if (profile_picture_url !== undefined) {
    updateData.profile_picture_url = profile_picture_url
  }

  // Only update active_until if it's provided
  if (active_until !== undefined) {
    updateData.active_until = active_until
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - Delete a user (admin only)
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient(request)

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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('id')

  if (!userId) {
    return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
  }

  // Don't allow deleting yourself
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  // Create admin client for user deletion
  const adminClient = createAdminSupabaseClient()

  // First, delete all bookings for this user
  const { error: bookingsError } = await adminClient
    .from('bookings')
    .delete()
    .eq('user_id', userId)

  if (bookingsError) {
    console.error('Error deleting user bookings:', bookingsError)
    return NextResponse.json({ error: 'Failed to delete user bookings: ' + bookingsError.message }, { status: 500 })
  }

  // Delete the user's profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileError) {
    console.error('Error deleting user profile:', profileError)
    return NextResponse.json({ error: 'Failed to delete user profile: ' + profileError.message }, { status: 500 })
  }

  // Finally, delete user from Supabase Auth
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

  if (deleteError) {
    console.error('Error deleting user from auth:', deleteError)
    return NextResponse.json({ error: 'Failed to delete user: ' + deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
