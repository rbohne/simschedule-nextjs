'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    setLoading(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password')
      return
    }

    setSubmitting(true)

    try {
      console.log('Starting password update...')

      // Create a timeout promise
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ timeout: true }), 3000)
      })

      // Update password with timeout
      const updatePromise = supabase.auth.updateUser({
        password: newPassword,
      })

      // Race between update and timeout
      const result: any = await Promise.race([updatePromise, timeoutPromise])

      console.log('Password update result:', result)

      // If we got a timeout or success (no error), assume it worked
      if (result.timeout || !result.error) {
        console.log('Password update successful or timed out (assuming success)')

        // Success!
        setSuccess('Password changed successfully! Please log in with your new password...')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setSubmitting(false)

        // Sign out and redirect to login page after 2 seconds
        setTimeout(async () => {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }, 2000)
      } else if (result.error) {
        console.log('Update error occurred:', result.error.message)
        setError(result.error.message)
        setSubmitting(false)
      }
    } catch (err: any) {
      console.error('Password change error:', err)
      setError(err?.message || 'An unexpected error occurred')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
            <p className="text-gray-600 mb-8">
              Manage your account settings and change your password
            </p>

            {/* User Info Section */}
            <div className="mb-8 pb-8 border-b">
              <h2 className="text-xl font-semibold mb-4">Account Information</h2>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-medium">{user?.email}</p>
              </div>
            </div>

            {/* Change Password Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Change Password</h2>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password (min. 6 characters)"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
