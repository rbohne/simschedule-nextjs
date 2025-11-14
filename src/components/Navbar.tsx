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
  const [showMobileMenu, setShowMobileMenu] = useState(false)
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
    try {
      // Try to sign out, but don't wait too long
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ])
    } catch (error) {
      // If signOut fails or times out, continue anyway
      console.log('SignOut error (continuing anyway):', error)
    }

    // Force a hard reload to /login to reinitialize the Supabase client
    // This fixes issues when the session has expired and the client is in a broken state
    window.location.href = '/login'
  }

  if (loading) {
    return null
  }

  return (
    <nav className="bg-black text-gray-100 shadow-lg border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/images/TheCave_Nav_LOGO_Small.png"
              alt="The Cave Golf"
              className="h-18 w-auto"
            />
          </Link>

          {/* Mobile Menu Button or Login Link */}
          {user ? (
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden text-gray-100 hover:text-gray-300 p-2"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          ) : (
            <Link href="/login" className="md:hidden hover:text-gray-300">
              Login
            </Link>
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link href="/" className="hover:text-gray-300">
                  Home
                </Link>
                {!isAdmin && (
                  <>
                    <span className="text-gray-600">|</span>
                    <Link href="/contact" className="hover:text-gray-300">
                      Contact Us
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <>
                    <span className="text-gray-600">|</span>
                    <div className="relative group">
                      <Link href="/settings" className="hover:text-gray-300">
                        Settings
                      </Link>
                      {/* Dropdown Menu */}
                      <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 border border-gray-700">
                        <div className="py-1">
                          <Link
                            href="/users"
                            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                          >
                            Users
                          </Link>
                          <Link
                            href="/messages"
                            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                          >
                            User Messages
                          </Link>
                          <Link
                            href="/tournament-messages"
                            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                          >
                            Home Page Messages
                          </Link>
                          <Link
                            href="/payments"
                            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                          >
                            User Payments
                          </Link>
                          <Link
                            href="/membership-report"
                            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                          >
                            Membership Report
                          </Link>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <span className="text-gray-600">|</span>
                <a
                  href="/Terms-and-Conditions.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-300"
                  title="View Terms and Conditions"
                >
                  📄 Terms & Conditions
                </a>
                <span className="text-gray-600">|</span>
                {/* User Dropdown */}
                <div className="relative user-dropdown">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="hover:text-gray-300 font-semibold flex items-center gap-1"
                  >
                    {userName}
                    <span className="text-xs">▼</span>
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700">
                      <div className="py-1">
                        <Link
                          href="/profile"
                          className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            handleLogout()
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login" className="hover:text-gray-300">
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && user && (
          <div className="md:hidden border-t border-gray-800 py-4">
            <div className="flex flex-col space-y-3">
              <Link
                href="/"
                className="hover:text-gray-300 px-2 py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                Home
              </Link>

              {!isAdmin && (
                <Link
                  href="/contact"
                  className="hover:text-gray-300 px-2 py-2"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Contact Us
                </Link>
              )}

              {isAdmin && (
                <>
                  <Link
                    href="/settings"
                    className="hover:text-gray-300 px-2 py-2"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Settings
                  </Link>
                  <div className="pl-4 space-y-2 border-l-2 border-gray-700">
                    <Link
                      href="/users"
                      className="block hover:text-gray-300 px-2 py-2 text-sm"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      Users
                    </Link>
                    <Link
                      href="/messages"
                      className="block hover:text-gray-300 px-2 py-2 text-sm"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      User Messages
                    </Link>
                    <Link
                      href="/tournament-messages"
                      className="block hover:text-gray-300 px-2 py-2 text-sm"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      Home Page Messages
                    </Link>
                    <Link
                      href="/payments"
                      className="block hover:text-gray-300 px-2 py-2 text-sm"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      User Payments
                    </Link>
                    <Link
                      href="/membership-report"
                      className="block hover:text-gray-300 px-2 py-2 text-sm"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      Membership Report
                    </Link>
                  </div>
                </>
              )}

              <a
                href="/Terms-and-Conditions.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-300 px-2 py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                📄 Terms & Conditions
              </a>

              <Link
                href="/profile"
                className="hover:text-gray-300 px-2 py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                Profile ({userName})
              </Link>

              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  handleLogout()
                }}
                className="text-left hover:text-gray-300 px-2 py-2"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
