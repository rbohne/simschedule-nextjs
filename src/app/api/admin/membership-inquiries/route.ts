import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET - Get all membership inquiries (admin only)
export async function GET(request: Request) {
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

  // Get all membership inquiries
  const adminClient = createAdminSupabaseClient()
  const { data: inquiries, error } = await adminClient
    .from('membership_inquiries')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('Error fetching membership inquiries:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(inquiries)
}

// PATCH - Update a membership inquiry (admin only)
export async function PATCH(request: Request) {
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
  const { id, admin_notes, is_read, is_resolved } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing inquiry ID' }, { status: 400 })
  }

  // Update inquiry
  const adminClient = createAdminSupabaseClient()
  const { error: updateError } = await adminClient
    .from('membership_inquiries')
    .update({
      admin_notes,
      is_read,
      is_resolved
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error updating membership inquiry:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - Delete a membership inquiry (admin only)
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
  const inquiryId = searchParams.get('id')

  if (!inquiryId) {
    return NextResponse.json({ error: 'Missing inquiry ID' }, { status: 400 })
  }

  // Delete inquiry
  const adminClient = createAdminSupabaseClient()
  const { error: deleteError } = await adminClient
    .from('membership_inquiries')
    .delete()
    .eq('id', inquiryId)

  if (deleteError) {
    console.error('Error deleting membership inquiry:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
