export type Simulator = 'east' | 'west'

export interface Profile {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: 'user' | 'admin'
  profile_picture_url: string | null
  created_at: string
}

export interface Booking {
  id: number
  user_id: string
  simulator: Simulator
  start_time: string
  end_time: string
  created_at: string
  profile?: Profile
}

export interface ContactMessage {
  id: number
  user_id: string
  user_name: string
  user_email: string
  user_phone: string
  issue_type: string
  subject: string
  message: string
  photo_url: string | null
  submitted_at: string
  is_read: boolean
  is_resolved: boolean
  admin_notes: string | null
}
