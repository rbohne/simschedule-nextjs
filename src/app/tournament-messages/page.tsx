'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface TournamentMessage {
  id: string
  message: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function TournamentMessagesPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<TournamentMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadMessages()
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

  async function loadMessages() {
    try {
      const response = await fetch('/api/tournament-messages')
      const data = await response.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  async function handleAddMessage(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!newMessage.trim()) {
      setError('Message cannot be empty')
      return
    }

    try {
      const response = await fetch('/api/tournament-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: newMessage }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to add message')
        return
      }

      setSuccess('Message added successfully!')
      setNewMessage('')
      loadMessages()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  async function handleUpdateMessage(id: string) {
    setError(null)
    setSuccess(null)

    if (!editingText.trim()) {
      setError('Message cannot be empty')
      return
    }

    try {
      const response = await fetch(`/api/tournament-messages/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: editingText }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update message')
        return
      }

      setSuccess('Message updated successfully!')
      setEditingId(null)
      setEditingText('')
      loadMessages()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/tournament-messages/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to toggle message status')
        return
      }

      setSuccess('Message status updated!')
      loadMessages()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  async function handleDeleteMessage(id: string) {
    if (!confirm('Are you sure you want to delete this message?')) {
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/tournament-messages/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to delete message')
        return
      }

      setSuccess('Message deleted successfully!')
      loadMessages()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  function startEditing(message: TournamentMessage) {
    setEditingId(message.id)
    setEditingText(message.message)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingText('')
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
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Manage Home Page Messages</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {/* Add New Message */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Add New Message</h2>

            {/* HTML Formatting Guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">HTML Formatting Guide:</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Header:</strong> <code>&lt;h3&gt;Tournament Title&lt;/h3&gt;</code></p>
                <p><strong>Bold:</strong> <code>&lt;strong&gt;Important text&lt;/strong&gt;</code></p>
                <p><strong>Link:</strong> <code>&lt;a href="https://example.com" target="_blank"&gt;Click here&lt;/a&gt;</code></p>
                <p><strong>Line break:</strong> <code>&lt;br/&gt;</code></p>
                <p><strong>Paragraph:</strong> <code>&lt;p&gt;Your text&lt;/p&gt;</code></p>
              </div>
            </div>

            <form onSubmit={handleAddMessage}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">HTML Content:</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Enter tournament message with HTML formatting..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Preview:</label>
                  <div className="border border-gray-300 rounded-md p-3 bg-yellow-50 min-h-[250px]">
                    {newMessage ? (
                      <div
                        className="tournament-message"
                        dangerouslySetInnerHTML={{ __html: newMessage }}
                      />
                    ) : (
                      <p className="text-gray-400 italic">Preview will appear here...</p>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2 mb-4">
                You can use HTML tags for formatting. The message will be displayed on the home page.
              </p>
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Message
              </button>
            </form>
          </div>

          {/* Messages List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Existing Messages</h2>

            {messages.length === 0 ? (
              <p className="text-gray-500">No messages yet. Add your first tournament message above!</p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`border rounded-lg p-4 ${
                      msg.is_active ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    {editingId === msg.id ? (
                      <div>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 font-mono text-sm"
                          rows={6}
                        />
                        <p className="text-sm text-gray-500 mb-2">Use HTML tags for formatting</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateMessage(msg.id)}
                            className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-800 mb-2">{msg.message}</p>
                        <div className="flex gap-2 text-sm">
                          <span
                            className={`px-2 py-1 rounded ${
                              msg.is_active
                                ? 'bg-green-200 text-green-800'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            {msg.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-gray-500">
                            Created: {new Date(msg.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => startEditing(msg)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(msg.id, msg.is_active)}
                            className={`px-3 py-1 rounded text-sm ${
                              msg.is_active
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : 'bg-green-600 hover:bg-green-700'
                            } text-white`}
                          >
                            {msg.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
