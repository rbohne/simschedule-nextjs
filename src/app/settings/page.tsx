'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/')
      return
    }

    setIsAdmin(true)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">Settings</h1>
          <p className="text-xl text-gray-600 mb-12 text-center">
            Administrator Configuration
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Users Card */}
            <Link href="/users">
              <div className="bg-white rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-2xl font-bold mb-2">Users</h3>
                <p className="text-gray-600">
                  Manage user accounts and permissions
                </p>
              </div>
            </Link>

            {/* Messages Card */}
            <Link href="/messages">
              <div className="bg-white rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-2xl font-bold mb-2">User Messages</h3>
                <p className="text-gray-600">
                  View contact form submissions
                </p>
              </div>
            </Link>

            {/* Tournaments Card */}
            <Link href="/tournament-messages">
              <div className="bg-white rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <div className="text-6xl mb-4">📢</div>
                <h3 className="text-2xl font-bold mb-2">Home Page Messages</h3>
                <p className="text-gray-600">
                  Manage home page announcements
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
