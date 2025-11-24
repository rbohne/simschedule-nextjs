"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface MembershipInquiry {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  submitted_at: string;
  is_read: boolean;
  is_resolved: boolean;
  admin_notes: string | null;
}

export default function MembershipInquiriesPage() {
  const [inquiries, setInquiries] = useState<MembershipInquiry[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<MembershipInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [selectedInquiry, setSelectedInquiry] = useState<MembershipInquiry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modal fields
  const [adminNotes, setAdminNotes] = useState("");
  const [isRead, setIsRead] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Helper function to get auth headers for fetch requests
  async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      console.error('[Membership Inquiries] Failed to get session:', e);
    }

    return headers;
  }

  // Counts
  const totalCount = inquiries.length;
  const unreadCount = inquiries.filter((i) => !i.is_read).length;
  const readCount = inquiries.filter((i) => i.is_read && !i.is_resolved).length;
  const resolvedCount = inquiries.filter((i) => i.is_resolved).length;

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
  }, []);

  async function checkAuth(mounted: boolean, authTimeout: NodeJS.Timeout) {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (!mounted) return;
      clearTimeout(authTimeout);

      if (error || !user) {
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
      await loadInquiries();
      setLoading(false);
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error('Auth check failed:', err);
      router.push("/login");
    }
  }

  async function loadInquiries() {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/admin/membership-inquiries", { headers });
    if (response.ok) {
      const data = await response.json();
      setInquiries(data);
      applyFilter("all", data);
    }
  }

  function applyFilter(filter: string, items = inquiries) {
    setCurrentFilter(filter);

    switch (filter) {
      case "unread":
        setFilteredInquiries(items.filter((i) => !i.is_read));
        break;
      case "read":
        setFilteredInquiries(items.filter((i) => i.is_read && !i.is_resolved));
        break;
      case "resolved":
        setFilteredInquiries(items.filter((i) => i.is_resolved));
        break;
      default:
        setFilteredInquiries(items);
    }
  }

  async function viewInquiry(inquiryId: number) {
    const inquiry = inquiries.find((i) => i.id === inquiryId);
    if (!inquiry) return;

    setSelectedInquiry(inquiry);
    setAdminNotes(inquiry.admin_notes || "");
    setIsRead(inquiry.is_read);
    setIsResolved(inquiry.is_resolved);

    // Auto-mark as read when viewing
    if (!inquiry.is_read) {
      const headers = await getAuthHeaders();
      await fetch("/api/admin/membership-inquiries", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: inquiryId,
          admin_notes: inquiry.admin_notes,
          is_read: true,
          is_resolved: inquiry.is_resolved,
        }),
      });
      setIsRead(true);
    }

    setShowDetailModal(true);
  }

  async function saveInquiryDetails() {
    if (!selectedInquiry) return;

    const headers = await getAuthHeaders();
    const response = await fetch("/api/admin/membership-inquiries", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        id: selectedInquiry.id,
        admin_notes: adminNotes,
        is_read: isRead,
        is_resolved: isResolved,
      }),
    });

    if (response.ok) {
      setShowDetailModal(false);
      await loadInquiries();
    }
  }

  async function deleteInquiry(inquiryId: number) {
    if (!confirm("Are you sure you want to delete this inquiry?")) {
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/membership-inquiries?id=${inquiryId}`, {
      method: "DELETE",
      headers,
    });

    if (response.ok) {
      await loadInquiries();
    }
  }

  function closeDetailModal() {
    setShowDetailModal(false);
    setSelectedInquiry(null);
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-200 text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Membership Inquiries</h1>
            <p className="text-gray-400 mt-1">Public inquiries from potential members</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadInquiries}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded border border-gray-600"
            >
              Refresh
            </button>
            <button
              onClick={() => router.push("/")}
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded"
            >
              Back to Home
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <select
            value={currentFilter}
            onChange={(e) => applyFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-gray-100 rounded px-4 py-2"
          >
            <option value="all">All Inquiries ({totalCount})</option>
            <option value="unread">Unread ({unreadCount})</option>
            <option value="read">Read ({readCount})</option>
            <option value="resolved">Resolved ({resolvedCount})</option>
          </select>
        </div>

        {/* Inquiries Table */}
        {filteredInquiries.length === 0 ? (
          <div className="bg-blue-900/50 border border-blue-700 text-blue-200 px-4 py-3 rounded">
            No membership inquiries found.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Message Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filteredInquiries.map((inquiry) => {
                  const { date, time } = formatDate(inquiry.submitted_at);
                  const rowClass = !inquiry.is_read ? "bg-green-900/20" : "";

                  return (
                    <tr
                      key={inquiry.id}
                      className={`${rowClass} hover:bg-gray-700 text-gray-200 cursor-pointer`}
                      onClick={() => viewInquiry(inquiry.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!inquiry.is_read && (
                          <span
                            className="inline-block w-3 h-3 bg-green-400 rounded-full"
                            title="New Inquiry"
                          ></span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{inquiry.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">{inquiry.email}</div>
                        {inquiry.phone && (
                          <div className="text-sm text-gray-400">{inquiry.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate">
                          {inquiry.message}
                        </div>
                        {inquiry.admin_notes && (
                          <div className="text-xs text-gray-400 mt-1">
                            Has notes
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>{date}</div>
                        <div className="text-gray-400">{time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {inquiry.is_resolved ? (
                          <span className="px-2 py-1 text-xs bg-green-900 text-green-200 border border-green-700 rounded">
                            Resolved
                          </span>
                        ) : inquiry.is_read ? (
                          <span className="px-2 py-1 text-xs bg-blue-900 text-blue-200 border border-blue-700 rounded">
                            Read
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-yellow-900 text-yellow-200 border border-yellow-700 rounded">
                            New
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewInquiry(inquiry.id);
                          }}
                          className="bg-blue-900 hover:bg-blue-800 text-gray-100 px-3 py-1 rounded text-sm mr-2 border border-blue-700"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteInquiry(inquiry.id);
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
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
      {showDetailModal && selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-100">
                <span className="bg-green-900 text-green-200 border border-green-700 px-2 py-1 rounded text-sm mr-2">
                  Membership Inquiry
                </span>
                {selectedInquiry.name}
              </h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                x
              </button>
            </div>

            <div className="p-6">
              {/* Contact Info */}
              <div className="bg-gray-700 rounded p-4 mb-4 border border-gray-600">
                <h3 className="font-bold mb-2 text-gray-100">Contact Information</h3>
                <p className="text-gray-200">
                  <strong>Name:</strong> {selectedInquiry.name}
                </p>
                <p className="text-gray-200">
                  <strong>Email:</strong>{" "}
                  <a
                    href={`mailto:${selectedInquiry.email}`}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {selectedInquiry.email}
                  </a>
                </p>
                {selectedInquiry.phone && (
                  <p className="text-gray-200">
                    <strong>Phone:</strong>{" "}
                    <a
                      href={`tel:${selectedInquiry.phone}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {selectedInquiry.phone}
                    </a>
                  </p>
                )}
                <p className="text-gray-200">
                  <strong>Submitted:</strong>{" "}
                  {formatDate(selectedInquiry.submitted_at).date}{" "}
                  {formatDate(selectedInquiry.submitted_at).time}
                </p>
              </div>

              {/* Message */}
              <div className="bg-gray-700 rounded p-4 mb-4 border border-gray-600">
                <h3 className="font-bold mb-2 text-gray-100">Message</h3>
                <p className="whitespace-pre-wrap text-gray-200">{selectedInquiry.message}</p>
              </div>

              {/* Admin Notes */}
              <div className="mb-4">
                <label className="block font-bold mb-2 text-gray-300">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  rows={4}
                  placeholder="Add notes about this inquiry (e.g., contacted, scheduled tour, etc.)..."
                />
              </div>

              {/* Status */}
              <div className="bg-gray-700 rounded p-4 mb-4 border border-gray-600">
                <h3 className="font-bold mb-2 text-gray-100">Status</h3>
                <label className="flex items-center mb-2 text-gray-200">
                  <input
                    type="checkbox"
                    checked={isRead}
                    onChange={(e) => setIsRead(e.target.checked)}
                    className="mr-2"
                  />
                  Mark as Read
                </label>
                <label className="flex items-center text-gray-200">
                  <input
                    type="checkbox"
                    checked={isResolved}
                    onChange={(e) => setIsResolved(e.target.checked)}
                    className="mr-2"
                  />
                  Mark as Resolved (e.g., contacted, became member, declined)
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={closeDetailModal}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded border border-gray-600"
                >
                  Close
                </button>
                <button
                  onClick={saveInquiryDetails}
                  className="flex-1 bg-blue-900 hover:bg-blue-800 text-gray-100 px-4 py-2 rounded border border-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
