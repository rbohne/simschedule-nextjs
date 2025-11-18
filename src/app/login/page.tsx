'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true) // Default to checked
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [inquirySuccess, setInquirySuccess] = useState(false)
  const [inquirySubmitting, setInquirySubmitting] = useState(false)
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const router = useRouter()

  // Clear any broken sessions on mount (especially important for mobile)
  useEffect(() => {
    const clearBrokenSession = async () => {
      try {
        // Check if we just did a cleanup reload to prevent infinite loop
        const justReloaded = sessionStorage.getItem('auth-cleanup-reload');
        if (justReloaded) {
          sessionStorage.removeItem('auth-cleanup-reload');
          return;
        }

        const supabase = createClient();

        // Set a timeout for the session check to prevent hanging
        const sessionCheckPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 3000)
        );

        const { data: { session }, error } = await Promise.race([
          sessionCheckPromise,
          timeoutPromise
        ]) as any;

        // Only cleanup if there's an actual error (not just "no session")
        // AuthSessionMissingError is normal for logged-out users
        if (error && error.message !== 'Auth session missing!') {
          console.log('Broken session detected, forcing cleanup:', error.message);
          await forceAuthCleanup();
        }
      } catch (e: any) {
        // Only cleanup on timeout, not on "session missing" errors
        if (e?.message === 'Session check timeout') {
          console.log('Session check timeout, forcing cleanup');
          await forceAuthCleanup();
        }
        // Silently ignore "Auth session missing" - it's expected on login page
      }
    };

    const forceAuthCleanup = async () => {
      if (typeof window !== 'undefined') {
        // Clear all Supabase-related storage
        const storageKeys = ['supabase.auth.token', 'sb-uxtdsiqlzhzrwqyozuho-auth-token'];
        storageKeys.forEach(key => {
          try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          } catch (e) {
            console.log('Storage clear error:', e);
          }
        });

        // Set flag and force reload to reinitialize Supabase client
        sessionStorage.setItem('auth-cleanup-reload', 'true');
        window.location.reload();
      }
    };

    clearBrokenSession();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Create client with appropriate storage based on "Remember Me" checkbox
      // If rememberMe is false, use sessionStorage (clears when browser closes)
      // If rememberMe is true, use localStorage (persists)
      const supabase = createClient(!rememberMe)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        // Login successful - clear any old flags and redirect
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('auth-cleanup-reload')
        }
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Login failed:', err)
      setError(err.message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  async function handleInquirySubmit(e: React.FormEvent) {
    e.preventDefault()
    setInquirySubmitting(true)

    try {
      const response = await fetch('/api/public/membership-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryForm)
      })

      if (response.ok) {
        setInquirySuccess(true)
        setInquiryForm({ name: '', email: '', phone: '', message: '' })
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to submit inquiry')
      }
    } catch (err) {
      setError('Failed to submit inquiry. Please try again.')
    } finally {
      setInquirySubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-black pt-12">
      {/* Logo - Centered */}
      <div className="flex justify-center mb-8">
        <img
          src="/images/TheCave_LOGO.png"
          alt="The Cave Golf"
          className="h-72 w-auto"
        />
      </div>

      {/* Main Content - Login Form and Membership Section Side by Side */}
      <div className="max-w-6xl w-full px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-start">
          {/* Left Side - Login Form */}
          <div className="space-y-8 bg-black flex justify-center">
            <div className="max-w-sm w-full">
              <div>
                <h2 className="text-3xl font-bold text-center text-gray-100">Sign In</h2>
                <p className="mt-2 text-center text-gray-400">
                  Cave Schedule - Booking System
                </p>
              </div>

              <form onSubmit={handleLogin} className="mt-8 space-y-6">
                {error && (
                  <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-600 rounded bg-gray-700"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                    Remember me
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>

          {/* Vertical Separator - Hidden on mobile, visible on large screens */}
          <div className="hidden lg:block w-px bg-gray-700 self-stretch"></div>

          {/* Right Side - Membership Information Section */}
          <div className="space-y-6 border-t lg:border-t-0 border-gray-700 pt-8 lg:pt-0">
            <h3 className="text-xl font-semibold text-center text-gray-100 mb-4">
              Not a Member Yet?
            </h3>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">$</span>
                  </div>
                  <div>
                    <h4 className="text-gray-100 font-medium">Annual Membership</h4>
                    <p className="text-gray-300 text-lg font-semibold">$400/year + GST</p>
                    <p className="text-gray-400 text-sm">Unlimited access to both simulators</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">+</span>
                  </div>
                  <div>
                    <h4 className="text-gray-100 font-medium">Guest Policy</h4>
                    <p className="text-gray-300">$20/guest per booking</p>
                    <p className="text-gray-400 text-sm">Guests can join members at any time. The fee is charged to the member's account.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              {!showInquiryForm && !inquirySuccess && (
                <button
                  onClick={() => setShowInquiryForm(true)}
                  className="bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-md font-medium transition-colors"
                >
                  Interested in Joining? Contact Us
                </button>
              )}

              {inquirySuccess && (
                <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded">
                  <p className="font-medium">Thank you for your interest!</p>
                  <p className="text-sm mt-1">We've received your inquiry and will get back to you soon.</p>
                </div>
              )}

              {showInquiryForm && !inquirySuccess && (
                <form onSubmit={handleInquirySubmit} className="mt-4 space-y-4 text-left">
                  <div>
                    <label htmlFor="inquiry-name" className="block text-sm font-medium text-gray-300">
                      Your Name *
                    </label>
                    <input
                      id="inquiry-name"
                      type="text"
                      required
                      value={inquiryForm.name}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="inquiry-email" className="block text-sm font-medium text-gray-300">
                      Email Address *
                    </label>
                    <input
                      id="inquiry-email"
                      type="email"
                      required
                      value={inquiryForm.email}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="inquiry-phone" className="block text-sm font-medium text-gray-300">
                      Phone Number (Optional)
                    </label>
                    <input
                      id="inquiry-phone"
                      type="tel"
                      value={inquiryForm.phone}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label htmlFor="inquiry-message" className="block text-sm font-medium text-gray-300">
                      Message *
                    </label>
                    <textarea
                      id="inquiry-message"
                      required
                      rows={3}
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      placeholder="I'm interested in becoming a member..."
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={inquirySubmitting}
                      className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 px-4 rounded-md font-medium disabled:opacity-50 transition-colors"
                    >
                      {inquirySubmitting ? 'Sending...' : 'Send Inquiry'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInquiryForm(false)}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 px-4 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
