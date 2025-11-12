'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  email?: string
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)

      // Check if user is admin and get user's name
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', user.id)
          .single()

        setIsAdmin(profile?.role === 'admin')
        setUserName(profile?.name || user.email?.split('@')[0] || '')
      }

      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      // Check admin role and get name when auth state changes
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', session.user.id)
          .single()

        setIsAdmin(profile?.role === 'admin')
        setUserName(profile?.name || session.user.email?.split('@')[0] || '')
      } else {
        setIsAdmin(false)
        setUserName('')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (showUserMenu && !target.closest('.user-dropdown')) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return null
  }

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/images/TheSimGuys_Logo_FINAL.png"
              alt="The Sim Guys"
              className="h-12 w-auto"
            />
            <span className="text-xl font-bold">SIM Schedule</span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/" className="hover:text-blue-200">
                  Home
                </Link>
                {!isAdmin && (
                  <>
                    <span className="text-blue-300">|</span>
                    <Link href="/contact" className="hover:text-blue-200">
                      Contact Us
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <>
                    <span className="text-blue-300">|</span>
                    <div className="relative group">
                      <Link href="/settings" className="hover:text-blue-200">
                        Settings
                      </Link>
                      {/* Dropdown Menu */}
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="py-1">
                          <Link
                            href="/users"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-900"
                          >
                            Users
                          </Link>
                          <Link
                            href="/messages"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-900"
                          >
                            User Messages
                          </Link>
                          <Link
                            href="/tournament-messages"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-900"
                          >
                            Home Page Messages
                          </Link>
                          <Link
                            href="/payments"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-900"
                          >
                            User Payments
                          </Link>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <span className="text-blue-300">|</span>
                <a
                  href="/Terms-and-Conditions.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-200"
                  title="View Terms and Conditions"
                >
                  📄 Terms & Conditions
                </a>
                <span className="text-blue-300">|</span>
                {/* User Dropdown */}
                <div className="relative user-dropdown">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="hover:text-blue-200 font-semibold flex items-center gap-1"
                  >
                    {userName}
                    <span className="text-xs">▼</span>
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
                      <div className="py-1">
                        <Link
                          href="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-900"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            handleLogout()
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-900"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login" className="hover:text-blue-200">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
