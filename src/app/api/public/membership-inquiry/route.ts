import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { sendMembershipInquiryNotification } from '@/lib/email'

// POST - Create a public membership inquiry (no auth required)
export async function POST(request: Request) {
  const body = await request.json()
  const { name, email, phone, message } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 })
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  const adminClient = createAdminSupabaseClient()

  // Create membership inquiry in dedicated table (no auth required)
  const { data: newInquiry, error: createError } = await adminClient
    .from('membership_inquiries')
    .insert({
      name,
      email,
      phone: phone || null,
      message,
      submitted_at: new Date().toISOString(),
      is_read: false,
      is_resolved: false,
      admin_notes: null
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating membership inquiry:', createError)
    return NextResponse.json({ error: 'Failed to submit inquiry. Please try again.' }, { status: 500 })
  }

  // Get all admin users' emails to send notification
  const { data: adminProfiles } = await adminClient
    .from('profiles')
    .select('email')
    .eq('role', 'admin')

  const adminEmails = adminProfiles?.map(profile => profile.email).filter(Boolean) || []

  // Send notification email to admins
  if (adminEmails.length > 0) {
    try {
      await sendMembershipInquiryNotification({
        inquiryName: name,
        inquiryEmail: email,
        inquiryPhone: phone,
        inquiryMessage: message,
        submittedAt: newInquiry.submitted_at,
        adminEmails,
      })
    } catch (err) {
      console.error('[Membership Inquiry API] Failed to send admin notification email:', err)
      // Don't fail the inquiry submission if email fails
    }
  }

  return NextResponse.json({ success: true, inquiry: newInquiry })
}
