"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Adjustment {
  id: number;
  user_id: string;
  booking_id: number | null;
  type: string;
  amount: string;
  description: string | null;
  created_at: string;
  created_by: string;
  profile?: {
    name: string;
    email: string;
    profile_picture_url: string | null;
  };
  creator?: {
    name: string;
  };
}

export default function AdjustmentHistoryPage() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
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
      await loadAdjustments();
      setLoading(false);
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error('Auth check failed:', err);
      router.push("/login");
    }
  }

  async function loadAdjustments() {
    try {
      // Fetch all adjustment transactions
      const { data: transactionsData, error: transError } = await supabase
        .from("user_transactions")
        .select("*")
        .eq("type", "adjustment")
        .order("created_at", { ascending: false });

      if (transError) {
        console.error("Error loading adjustments:", transError);
        return;
      }

      if (!transactionsData || transactionsData.length === 0) {
        setAdjustments([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(transactionsData.map(t => t.user_id))];
      const creatorIds = [...new Set(transactionsData.map(t => t.created_by).filter(Boolean))];
      const allUserIds = [...new Set([...userIds, ...creatorIds])];

      // Fetch all profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, email, profile_picture_url")
        .in("id", allUserIds);

      // Create lookup map
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Combine the data
      const enrichedAdjustments = transactionsData.map(transaction => ({
        ...transaction,
        profile: profilesMap.get(transaction.user_id),
        creator: profilesMap.get(transaction.created_by),
      }));

      setAdjustments(enrichedAdjustments);
    } catch (err) {
      console.error("Error loading adjustments:", err);
    }
  }

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

  const totalAdjustments = adjustments.reduce((sum, adj) => sum + parseFloat(adj.amount), 0);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-100">Adjustment History</h1>
            <p className="text-gray-400 mt-2">
              View all balance adjustments made by admins
            </p>
          </div>

          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Adjustments</div>
              <div className={`text-3xl font-bold ${totalAdjustments >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                ${totalAdjustments.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Transactions</div>
              <div className="text-3xl font-bold text-gray-100">
                {adjustments.length}
              </div>
            </div>
          </div>

          {/* Adjustments Table */}
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Adjustment Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Notes/Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Adjusted By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        No adjustments found
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adjustment) => {
                      const createdDate = new Date(adjustment.created_at);
                      const amount = parseFloat(adjustment.amount);

                      return (
                        <tr key={adjustment.id} className="hover:bg-gray-700 text-gray-200">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {createdDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-xs text-gray-400">
                              {createdDate.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {adjustment.profile?.profile_picture_url ? (
                                <img
                                  src={adjustment.profile.profile_picture_url}
                                  alt={adjustment.profile.name || 'User'}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-semibold border border-gray-600">
                                  {(adjustment.profile?.name || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium">
                                  {adjustment.profile?.name || 'Unknown'}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {adjustment.profile?.email || ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300 max-w-md whitespace-pre-line">
                              {adjustment.description || <span className="text-gray-500 italic">No notes</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-lg font-semibold ${
                              amount >= 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              {amount >= 0 ? '+' : ''}${amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {adjustment.creator?.name || 'System'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
