"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Booking } from "@/types/database";

export default function BookingsReportPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Default to last 7 days
  const getLastWeekDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getLastWeekDate());
  const [endDate, setEndDate] = useState(getTodayDate());

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

  useEffect(() => {
    if (isAdmin) {
      loadBookings();
    }
  }, [isAdmin, startDate, endDate]);

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
      setLoading(false);
    } catch (err) {
      if (!mounted) return;
      clearTimeout(authTimeout);
      console.error('Auth check failed:', err);
      router.push("/login");
    }
  }

  async function loadBookings() {
    setLoading(true);
    const response = await fetch(
      `/api/admin/bookings-report?startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T23:59:59.999Z`
    );

    if (response.ok) {
      const data: Booking[] = await response.json();
      setBookings(data);
    }
    setLoading(false);
  }

  function formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatSimulator(simulator: string) {
    return simulator.charAt(0).toUpperCase() + simulator.slice(1);
  }

  const totalBookings = bookings.length;
  const totalHours = bookings.length * 2; // Each booking is 2 hours

  if (loading && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-200 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Bookings Report</h1>
          <button
            onClick={() => router.push("/")}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded"
          >
            ← Back to Home
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Date Range</h2>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-200"
              />
            </div>
            <button
              onClick={loadBookings}
              className="bg-blue-800 hover:bg-blue-700 text-gray-200 px-6 py-2 rounded"
            >
              Load Report
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Bookings</div>
            <div className="text-3xl font-bold text-green-400">{totalBookings}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Hours Booked</div>
            <div className="text-3xl font-bold text-blue-400">{totalHours}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Date Range</div>
            <div className="text-lg font-semibold text-gray-200">
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Simulator</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Start Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">End Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Loading bookings...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No bookings found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        {booking.profile?.first_name && booking.profile?.last_name
                          ? `${booking.profile.first_name} ${booking.profile.last_name}`
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {booking.profile?.email || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-900/40 border border-blue-700 rounded text-sm">
                          {formatSimulator(booking.simulator)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDateTime(booking.start_time)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDateTime(booking.end_time)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-green-400 font-semibold">2 hours</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
