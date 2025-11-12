import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET - Fetch tournament messages (all for admins, only active for regular users)
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('tournament_messages')
    .select('*')
    .order('created_at', { ascending: false })

  // If not admin, only show active messages
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // If not admin, filter to only active messages
    if (profile?.role !== 'admin') {
      query = query.eq('is_active', true)
    }
  } else {
    // Not logged in, only show active messages
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tournament messages:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data })
}

// POST - Create a new tournament message (admin only)
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { message } = body

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tournament_messages')
      .insert([
        {
          message: message.trim(),
          is_active: true,
          created_by: user.id,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating tournament message:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
