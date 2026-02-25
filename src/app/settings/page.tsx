'use client'

import { useEffect, useState } from 'react'
import { createClient, getStoredSession, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true;

    const stored = getStoredSession();
    if (!stored?.user) {
      router.push('/login')
      return
    }

    ;(async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${stored.user.id}`,
          { headers: { 'Authorization': `Bearer ${stored.access_token}`, 'apikey': supabaseAnonKey } }
        )
        if (!mounted) return
        if (res.status === 401) { router.push('/login'); return }
        if (!res.ok) { router.push('/'); return }
        const profiles = await res.json()
        if (!mounted) return
        if (profiles?.[0]?.role !== 'admin') { router.push('/'); return }
        setUser(stored.user)
        setIsAdmin(true)
        setLoading(false)
      } catch {
        if (mounted) router.push('/login')
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') router.push('/login')
    });

    return () => { mounted = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <h1 className="text-4xl font-bold mb-8 text-center text-gray-100">Settings</h1>
          <p className="text-xl text-gray-400 mb-12 text-center">
            Administrator Configuration
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Users Card */}
            <Link href="/users">
              <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-gray-700 hover:border-blue-600">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-100">Users</h3>
                <p className="text-gray-400">
                  Manage user accounts and permissions
                </p>
              </div>
            </Link>

            {/* Messages Card */}
            <Link href="/messages">
              <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-gray-700 hover:border-blue-600">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-100">User Messages</h3>
                <p className="text-gray-400">
                  View contact form submissions
                </p>
              </div>
            </Link>

            {/* Tournaments Card */}
            <Link href="/tournament-messages">
              <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-gray-700 hover:border-blue-600">
                <div className="text-6xl mb-4">📢</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-100">Home Page Messages</h3>
                <p className="text-gray-400">
                  Manage home page announcements
                </p>
              </div>
            </Link>

            {/* User Payments Card */}
            <Link href="/payments">
              <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-gray-700 hover:border-blue-600">
                <div className="text-6xl mb-4">💵</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-100">User Payments</h3>
                <p className="text-gray-400">
                  Manage guest fees and payments
                </p>
              </div>
            </Link>

            {/* Membership Inquiries Card */}
            <Link href="/membership-inquiries">
              <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow cursor-pointer border-2 border-gray-700 hover:border-green-600">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-100">Membership Inquiries</h3>
                <p className="text-gray-400">
                  View inquiries from potential members
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
