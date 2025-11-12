"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
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
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    const authTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.error("Auth check timed out, redirecting to login");
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
        error,
      } = await supabase.auth.getUser();

      if (!mounted) return;
      clearTimeout(authTimeout);

      if (error || !user) {
        console.error("Auth error:", error);
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
      await loadBalances();
      setLoading(false);
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error("Auth check failed:", err);
      router.push("/login");
    }
  }

  async function loadBalances() {
    const response = await fetch("/api/transactions?action=balances");
    if (response.ok) {
      const data = await response.json();
      setUserBalances(data);
    } else {
      setError("Failed to load balances");
    }
  }

  async function loadTransactions(userId: string) {
    const response = await fetch(`/api/transactions?userId=${userId}`);
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

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">User Payments</h1>

          {/* Alerts */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex justify-between items-center">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-700 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex justify-between items-center">
              <span>{success}</span>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-700 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Users with Balances Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userBalances.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No outstanding balances
                    </td>
                  </tr>
                ) : (
                  userBalances.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
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
                        <span className="text-lg font-bold text-red-600">
                          ${user.balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openTransactionsModal(user)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View History
                        </button>
                        <button
                          onClick={() => openPaymentModal(user)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Add Payment
                        </button>
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
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Transaction History - {selectedUser.name}
              </h2>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-gray-500">No transactions found</p>
              ) : (
                transactions.map((trans) => (
                  <div
                    key={trans.id}
                    className="border rounded p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold">
                        {trans.type === "guest_fee"
                          ? "Guest Fee"
                          : trans.type === "payment"
                          ? "Payment"
                          : "Adjustment"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {trans.description}
                      </div>
                      {trans.booking && (
                        <div className="text-xs text-gray-500">
                          {new Date(
                            trans.booking.start_time
                          ).toLocaleDateString()}{" "}
                          - {trans.booking.simulator.toUpperCase()} SIM
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {new Date(trans.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        trans.amount > 0 ? "text-red-600" : "text-green-600"
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
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
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
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Add Payment - {selectedUser.name}
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Current Balance:{" "}
                <span className="text-red-600 font-bold text-xl">
                  ${selectedUser.balance.toFixed(2)}
                </span>
              </p>
            </div>

            <form onSubmit={handleAddPayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Payment Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
