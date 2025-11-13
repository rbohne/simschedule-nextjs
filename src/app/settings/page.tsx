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
    let mounted = true;
    const authTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.error('Auth check timed out, redirecting to login');
        router.push('/login')
      }
    }, 10000);

    checkAuth(mounted, authTimeout)

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAuth(mounted: boolean, authTimeout: NodeJS.Timeout) {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (!mounted) return;
      clearTimeout(authTimeout);

      if (error || !user) {
        console.error('Auth error:', error);
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
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error('Auth check failed:', err);
      router.push('/login')
    }
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
          </div>
        </div>
      </div>
    </div>
  )
}
