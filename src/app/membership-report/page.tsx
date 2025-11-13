"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

export default function MembershipReportPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const router = useRouter();
  const supabase = createClient();

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
        console.error('Auth error:', error);
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
      await loadUsers();
      setLoading(false);
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error('Auth check failed:', err);
      router.push("/login");
    }
  }

  async function loadUsers() {
    const response = await fetch("/api/users");
    if (response.ok) {
      const data: Profile[] = await response.json();

      // Sort users: active first (by expiration date), then expired (by expiration date)
      const sortedUsers = data.sort((a, b) => {
        const aDate = a.active_until ? new Date(a.active_until) : null;
        const bDate = b.active_until ? new Date(b.active_until) : null;
        const now = new Date();

        // Users without active_until go to the end
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;

        const aExpired = aDate <= now;
        const bExpired = bDate <= now;

        // Active users before expired users
        if (!aExpired && bExpired) return -1;
        if (aExpired && !bExpired) return 1;

        // Within the same group (both active or both expired), sort by date
        return aDate.getTime() - bDate.getTime();
      });

      setUsers(sortedUsers);
    }
  }

  // Format date as "November 30th, 2026"
  const formatDateWithOrdinal = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();

    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return `${month} ${getOrdinal(day)}, ${year}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-100">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const now = new Date();

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-100">Membership Report</h1>
            <p className="text-gray-400 mt-2">
              View all user memberships sorted by expiration date
            </p>
          </div>

          {/* Users Table */}
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Photo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Active Until
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Days Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const activeUntil = user.active_until ? new Date(user.active_until) : null;
                    const isActive = activeUntil && activeUntil > now;
                    const daysRemaining = activeUntil
                      ? Math.ceil((activeUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <tr key={user.id} className="hover:bg-gray-700 text-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.profile_picture_url ? (
                            <img
                              src={user.profile_picture_url}
                              alt={user.name || 'User'}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-semibold border border-gray-600">
                              {(user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {activeUntil ? (
                            <span className="text-gray-200">
                              {formatDateWithOrdinal(activeUntil)}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm italic">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!activeUntil ? (
                            <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-400 border border-gray-600">
                              No Date
                            </span>
                          ) : isActive ? (
                            <span className={`px-2 py-1 text-xs rounded ${
                              daysRemaining && daysRemaining <= 30
                                ? "bg-yellow-900 text-yellow-200 border border-yellow-700"
                                : "bg-green-900 text-green-200 border border-green-700"
                            }`}>
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded bg-red-900 text-red-200 border border-red-700">
                              Expired
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!activeUntil ? (
                            <span className="text-gray-500 text-sm">-</span>
                          ) : isActive ? (
                            <span className={`${
                              daysRemaining && daysRemaining <= 30 ? "text-yellow-200" : "text-green-200"
                            }`}>
                              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-red-200">
                              Expired {Math.abs(daysRemaining || 0)} day{Math.abs(daysRemaining || 0) !== 1 ? 's' : ''} ago
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Users</div>
              <div className="text-2xl font-bold text-gray-100">
                {users.length}
              </div>
            </div>
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
              <div className="text-green-300 text-sm">Active</div>
              <div className="text-2xl font-bold text-green-100">
                {users.filter(u => u.active_until && new Date(u.active_until) > now).length}
              </div>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
              <div className="text-yellow-300 text-sm">Expiring Soon (≤30 days)</div>
              <div className="text-2xl font-bold text-yellow-100">
                {users.filter(u => {
                  if (!u.active_until) return false;
                  const date = new Date(u.active_until);
                  const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return days > 0 && days <= 30;
                }).length}
              </div>
            </div>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
              <div className="text-red-300 text-sm">Expired</div>
              <div className="text-2xl font-bold text-red-100">
                {users.filter(u => u.active_until && new Date(u.active_until) <= now).length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
