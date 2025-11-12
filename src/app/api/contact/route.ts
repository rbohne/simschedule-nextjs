import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET - Get all contact messages (admin only)
export async function GET() {
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  // Get all contact messages
  const { data: messages, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(messages)
}

// POST - Create a new contact message (authenticated users)
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const body = await request.json()
  const { issue_type, subject, message, photo_url } = body

  if (!issue_type || !subject || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Use admin client to bypass RLS for insert
  const { createAdminSupabaseClient } = await import('@/lib/supabase-server')
  const adminClient = createAdminSupabaseClient()

  // Create contact message
  const { data: newMessage, error: createError } = await adminClient
    .from('contact_messages')
    .insert({
      user_id: user.id,
      user_name: profile.name || 'Unknown',
      user_email: profile.email,
      user_phone: profile.phone || '',
      issue_type,
      subject,
      message,
      photo_url: photo_url || null,
      submitted_at: new Date().toISOString(),
      is_read: false,
      is_resolved: false,
      admin_notes: null
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating contact message:', createError)
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: newMessage })
}

// PATCH - Update a contact message (admin only)
export async function PATCH(request: Request) {
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { id, admin_notes, is_read, is_resolved } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing message ID' }, { status: 400 })
  }

  // Update message
  const { error: updateError } = await supabase
    .from('contact_messages')
    .update({
      admin_notes,
      is_read,
      is_resolved
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - Delete a contact message (admin only)
export async function DELETE(request: Request) {
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('id')

  if (!messageId) {
    return NextResponse.json({ error: 'Missing message ID' }, { status: 400 })
  }

  // Delete message
  const { error: deleteError } = await supabase
    .from('contact_messages')
    .delete()
    .eq('id', messageId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
