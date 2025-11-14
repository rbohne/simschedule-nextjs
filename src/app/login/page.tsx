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
  const router = useRouter()

  // Clear any broken sessions on mount (especially important for mobile)
  useEffect(() => {
    const clearBrokenSession = async () => {
      try {
        // Check if we just did a cleanup reload to prevent infinite loop
        const justReloaded = sessionStorage.getItem('auth-cleanup-reload');
        if (justReloaded) {
          sessionStorage.removeItem('auth-cleanup-reload');
          console.log('Auth cleanup completed');
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

        // If there's an error or timeout, force cleanup and reload
        if (error) {
          console.log('Broken session detected, forcing cleanup:', error.message);
          await forceAuthCleanup();
        }
      } catch (e) {
        console.log('Session check error or timeout, forcing cleanup:', e);
        await forceAuthCleanup();
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

  return (
    <div className="min-h-screen flex items-start justify-center bg-black pt-12">
      <div className="max-w-md w-full space-y-8 p-8 bg-black">
        <div>
          <div className="flex justify-center mb-6">
            <img
              src="/images/TheCave_LOGO.png"
              alt="The Cave Golf"
              className="h-72 w-auto"
            />
          </div>
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
  )
}
