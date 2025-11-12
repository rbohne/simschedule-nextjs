"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { ContactMessage } from "@/types/database";

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessage[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modal fields
  const [adminNotes, setAdminNotes] = useState("");
  const [isRead, setIsRead] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Counts
  const totalCount = messages.length;
  const unreadCount = messages.filter((m) => !m.is_read).length;
  const readCount = messages.filter((m) => m.is_read && !m.is_resolved).length;
  const resolvedCount = messages.filter((m) => m.is_resolved).length;

  useEffect(() => {
    let mounted = true;
    const authTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.error('Auth check timed out, redirecting to login');
        router.push("/login");
      }
    }, 10000);

    checkAuth(mounted, authTimeout);

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth(mounted: boolean, authTimeout: NodeJS.Timeout) {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (!mounted) return;
      clearTimeout(authTimeout);

      if (error) {
        console.error('Auth error:', error);
        router.push("/login");
        return;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      await loadMessages();
      setLoading(false);
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error('Auth check failed:', err);
      router.push("/login");
    }
  }

  async function loadMessages() {
    const response = await fetch("/api/contact");
    if (response.ok) {
      const data = await response.json();
      setMessages(data);
      applyFilter("all", data);
    }
  }

  function applyFilter(filter: string, msgs = messages) {
    setCurrentFilter(filter);

    switch (filter) {
      case "unread":
        setFilteredMessages(msgs.filter((m) => !m.is_read));
        break;
      case "read":
        setFilteredMessages(msgs.filter((m) => m.is_read && !m.is_resolved));
        break;
      case "resolved":
        setFilteredMessages(msgs.filter((m) => m.is_resolved));
        break;
      default:
        setFilteredMessages(msgs);
    }
  }

  async function viewMessage(messageId: number) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    setSelectedMessage(message);
    setAdminNotes(message.admin_notes || "");
    setIsRead(message.is_read);
    setIsResolved(message.is_resolved);

    // Auto-mark as read when viewing
    if (!message.is_read) {
      await fetch("/api/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: messageId,
          admin_notes: message.admin_notes,
          is_read: true,
          is_resolved: message.is_resolved,
        }),
      });
      setIsRead(true);
    }

    setShowDetailModal(true);
  }

  async function saveMessageDetails() {
    if (!selectedMessage) return;

    const response = await fetch("/api/contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedMessage.id,
        admin_notes: adminNotes,
        is_read: isRead,
        is_resolved: isResolved,
      }),
    });

    if (response.ok) {
      setShowDetailModal(false);
      await loadMessages();
    }
  }

  async function deleteMessage(messageId: number) {
    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    const response = await fetch(`/api/contact?id=${messageId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await loadMessages();
    }
  }

  function closeDetailModal() {
    setShowDetailModal(false);
    setSelectedMessage(null);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Contact Messages</h1>
          <button
            onClick={loadMessages}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <select
            value={currentFilter}
            onChange={(e) => applyFilter(e.target.value)}
            className="border border-gray-300 rounded px-4 py-2"
          >
            <option value="all">All Messages ({totalCount})</option>
            <option value="unread">Unread ({unreadCount})</option>
            <option value="read">Read ({readCount})</option>
            <option value="resolved">Resolved ({resolvedCount})</option>
          </select>
        </div>

        {/* Messages Table */}
        {filteredMessages.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            No messages found.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">

                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Issue Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMessages.map((message) => {
                  const { date, time } = formatDate(message.submitted_at);
                  const rowClass = !message.is_read ? "bg-blue-50" : "";

                  return (
                    <tr
                      key={message.id}
                      className={`${rowClass} hover:bg-gray-50 cursor-pointer`}
                      onClick={() => viewMessage(message.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!message.is_read && (
                          <span
                            className="inline-block w-3 h-3 bg-blue-600 rounded-full"
                            title="Unread"
                          ></span>
                        )}
                        {message.photo_url && (
                          <span className="ml-2" title="Has attachment">
                            📎
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{message.user_name}</div>
                        <div className="text-sm text-gray-500">
                          {message.user_email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                          {message.issue_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {message.subject}
                        {message.admin_notes && (
                          <div className="text-xs text-gray-500 mt-1">
                            📝 Has notes
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>{date}</div>
                        <div className="text-gray-500">{time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {message.is_resolved ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Resolved
                          </span>
                        ) : message.is_read ? (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Read
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            New
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewMessage(message.id);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm mr-2"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessage(message.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm mr-2">
                  {selectedMessage.issue_type}
                </span>
                {selectedMessage.subject}
              </h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* User Info */}
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h3 className="font-bold mb-2">From</h3>
                <p>
                  <strong>Name:</strong> {selectedMessage.user_name}
                </p>
                <p>
                  <strong>Email:</strong>{" "}
                  <a
                    href={`mailto:${selectedMessage.user_email}`}
                    className="text-blue-600"
                  >
                    {selectedMessage.user_email}
                  </a>
                </p>
                <p>
                  <strong>Phone:</strong>{" "}
                  <a
                    href={`tel:${selectedMessage.user_phone}`}
                    className="text-blue-600"
                  >
                    {selectedMessage.user_phone}
                  </a>
                </p>
                <p>
                  <strong>Submitted:</strong>{" "}
                  {formatDate(selectedMessage.submitted_at).date}{" "}
                  {formatDate(selectedMessage.submitted_at).time}
                </p>
              </div>

              {/* Message */}
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h3 className="font-bold mb-2">Message</h3>
                <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>

              {/* Photo Attachment */}
              {selectedMessage.photo_url && (
                <div className="bg-gray-50 rounded p-4 mb-4">
                  <h3 className="font-bold mb-2">Photo Attachment</h3>
                  <div className="text-center">
                    <img
                      src={selectedMessage.photo_url}
                      alt="Attachment"
                      className="max-w-full max-h-96 rounded border border-gray-300 mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div className="mb-4">
                <label className="block font-bold mb-2">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows={4}
                  placeholder="Add notes about this message..."
                />
              </div>

              {/* Status */}
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h3 className="font-bold mb-2">Status</h3>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={isRead}
                    onChange={(e) => setIsRead(e.target.checked)}
                    className="mr-2"
                  />
                  Mark as Read
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isResolved}
                    onChange={(e) => setIsResolved(e.target.checked)}
                    className="mr-2"
                  />
                  Mark as Resolved
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={closeDetailModal}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                >
                  Close
                </button>
                <button
                  onClick={saveMessageDetails}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  💾 Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
