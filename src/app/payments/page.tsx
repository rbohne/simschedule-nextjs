"use client";

import { useEffect, useState } from "react";
import { createClient, getStoredSession, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

interface UserBalance extends Profile {
  balance: number;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  booking?: {
    start_time: string;
    simulator: string;
  };
}

export default function PaymentsPage() {
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Helper function to get auth headers for fetch requests
  async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const stored = getStoredSession();
    if (stored?.access_token) {
      headers['Authorization'] = `Bearer ${stored.access_token}`;
    }

    return headers;
  }

  useEffect(() => {
    let mounted = true;

    const stored = getStoredSession();
    if (!stored?.user) {
      router.push('/login');
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${stored.user.id}`,
          { headers: { 'Authorization': `Bearer ${stored.access_token}`, 'apikey': supabaseAnonKey } }
        );
        if (!mounted) return;
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) { router.push('/'); return; }
        const profiles = await res.json();
        if (!mounted) return;
        if (profiles?.[0]?.role !== 'admin') { router.push('/'); return; }
        setIsAdmin(true);
        setLoading(false);
        loadBalances();
      } catch {
        if (mounted) router.push('/login');
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') router.push('/login');
    });

    return () => { mounted = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBalances() {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/transactions?action=balances", { headers });
    if (response.ok) {
      const data = await response.json();
      setUserBalances(data);
    } else {
      setError("Failed to load balances");
    }
  }

  async function loadTransactions(userId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/transactions?userId=${userId}`, { headers });
    if (response.ok) {
      const data = await response.json();
      setTransactions(data);
    } else {
      setError("Failed to load transactions");
    }
  }

  function openTransactionsModal(user: UserBalance) {
    setSelectedUser(user);
    loadTransactions(user.id);
    setShowTransactionsModal(true);
  }

  function openPaymentModal(user: UserBalance) {
    setSelectedUser(user);
    setPaymentAmount("");
    setShowPaymentModal(true);
  }

  function openAdjustModal(user: UserBalance) {
    setSelectedUser(user);
    setAdjustAmount("");
    setAdjustReason("");
    setShowAdjustModal(true);
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !paymentAmount) return;

    setIsProcessing(true);
    setError(null);

    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        setError("Please enter a valid amount");
        setIsProcessing(false);
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: selectedUser.id,
          type: "payment",
          amount: -amount, // Negative amount for payment
          description: `Payment received`,
        }),
      });

      if (response.ok) {
        setSuccess("Payment recorded successfully!");
        await loadBalances();
        setShowPaymentModal(false);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to record payment");
      }
    } catch (err) {
      setError("An error occurred while recording payment");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !adjustAmount) return;

    setIsProcessing(true);
    setError(null);

    try {
      const newBalance = parseFloat(adjustAmount);
      if (isNaN(newBalance) || newBalance < 0) {
        setError("Please enter a valid amount (0 or greater)");
        setIsProcessing(false);
        return;
      }

      // Calculate the adjustment needed
      const currentBalance = selectedUser.balance;
      const adjustmentAmount = newBalance - currentBalance;

      const headers = await getAuthHeaders();
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: selectedUser.id,
          type: "adjustment",
          amount: adjustmentAmount,
          description: adjustReason
            ? `${adjustReason}\n\nBalance adjusted from $${currentBalance.toFixed(2)} to $${newBalance.toFixed(2)}`
            : `Balance adjusted from $${currentBalance.toFixed(2)} to $${newBalance.toFixed(2)}`,
        }),
      });

      if (response.ok) {
        setSuccess("Balance adjusted successfully!");
        await loadBalances();
        setShowAdjustModal(false);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to adjust balance");
      }
    } catch (err) {
      setError("An error occurred while adjusting balance");
    } finally {
      setIsProcessing(false);
    }
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
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-100">User Payments</h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/guest-payments')}
                className="bg-blue-900 hover:bg-blue-800 text-gray-100 px-4 py-2 rounded border border-blue-700"
              >
                View Payment History
              </button>
              <button
                onClick={() => router.push('/adjustment-history')}
                className="bg-purple-900 hover:bg-purple-800 text-gray-100 px-4 py-2 rounded border border-purple-700"
              >
                View Adjustment History
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded flex justify-between items-center">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-200 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded flex justify-between items-center">
              <span>{success}</span>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-200 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Users with Balances Table */}
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
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
                    Outstanding Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {userBalances.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-gray-400"
                    >
                      No outstanding balances
                    </td>
                  </tr>
                ) : (
                  userBalances.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-700 text-gray-200">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-red-400">
                          ${user.balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-3">
                          <button
                            onClick={() => openTransactionsModal(user)}
                            className="text-2xl text-blue-400 hover:text-blue-300 transition-colors"
                            title="View History"
                          >
                            📊
                          </button>
                          <button
                            onClick={() => openPaymentModal(user)}
                            className="text-2xl text-green-400 hover:text-green-300 transition-colors"
                            title="Add Payment"
                          >
                            💵
                          </button>
                          <button
                            onClick={() => openAdjustModal(user)}
                            className="text-2xl text-yellow-400 hover:text-yellow-300 transition-colors"
                            title="Adjust Balance"
                          >
                            ⚙️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transactions Modal */}
      {showTransactionsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full p-6 max-h-[80vh] overflow-y-auto border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-100">
                Transaction History - {selectedUser.name}
              </h2>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-gray-400">No transactions found</p>
              ) : (
                transactions.map((trans) => (
                  <div
                    key={trans.id}
                    className="bg-gray-700 border border-gray-600 rounded p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-gray-100">
                        {trans.type === "guest_fee"
                          ? "Guest Fee"
                          : trans.type === "payment"
                          ? "Payment"
                          : "Adjustment"}
                      </div>
                      <div className="text-sm text-gray-300">
                        {trans.description}
                      </div>
                      {trans.booking && (
                        <div className="text-sm text-blue-400 font-medium">
                          Booking: {new Date(
                            trans.booking.start_time
                          ).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                          })}{" "}
                          - {trans.booking.simulator.toUpperCase()} SIM
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Recorded: {new Date(trans.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        trans.amount > 0 ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {trans.amount > 0 ? "+" : ""}$
                      {Math.abs(trans.amount).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-right">
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded border border-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-100">
                Add Payment - {selectedUser.name}
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-200 mb-2">
                Current Balance:{" "}
                <span className="text-red-400 font-bold text-xl">
                  ${selectedUser.balance.toFixed(2)}
                </span>
              </p>
            </div>

            <form onSubmit={handleAddPayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Payment Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded border border-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-green-900 hover:bg-green-800 text-gray-100 px-4 py-2 rounded border border-green-700 disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {showAdjustModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-100">
                Adjust Balance - {selectedUser.name}
              </h2>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-200 mb-2">
                Current Balance:{" "}
                <span className="text-red-400 font-bold text-xl">
                  ${selectedUser.balance.toFixed(2)}
                </span>
              </p>
            </div>

            <form onSubmit={handleAdjustBalance}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  New Balance Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Enter the new total balance (e.g., 0.00 to clear balance)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  placeholder="e.g., Balance forgiven, error correction"
                  maxLength={200}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded border border-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-yellow-900 hover:bg-yellow-800 text-gray-100 px-4 py-2 rounded border border-yellow-700 disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Adjust Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
