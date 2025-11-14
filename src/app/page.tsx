"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Simulator, Booking, Profile, GuestTransaction } from "@/types/database";

// MST is UTC-7
const MST_OFFSET = -7;

function convertToMST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * MST_OFFSET);
}

function getMSTNow(): Date {
  return convertToMST(new Date());
}

interface TournamentMessage {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSimulator, setSelectedSimulator] = useState<Simulator | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date>(getMSTNow());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Date[]>([]);
  const [userTotalBookedHours, setUserTotalBookedHours] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tournamentMessages, setTournamentMessages] = useState<TournamentMessage[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [addingGuestFee, setAddingGuestFee] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState(0);

  const router = useRouter();
  const supabase = createClient();

  async function loadUserProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setUserProfile(data);
    }
  }

  async function loadTournamentMessages() {
    try {
      const response = await fetch('/api/tournament-messages');
      const data = await response.json();
      if (data.messages) {
        setTournamentMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading tournament messages:', error);
    }
  }

  async function loadUserBalance(userId: string) {
    try {
      const response = await fetch(`/api/transactions?userId=${userId}`);
      if (response.ok) {
        const transactions = await response.json();

        // Calculate total balance from all transactions
        const balance = transactions.reduce((sum: number, trans: any) => {
          return sum + parseFloat(trans.amount);
        }, 0);

        setUserBalance(balance > 0 ? balance : 0);
      }
    } catch (error) {
      console.error('Error loading user balance:', error);
    }
  }

  useEffect(() => {
    let mounted = true;

    // Create a timeout to prevent hanging forever
    const authTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.error('Auth check timed out, cleaning up and redirecting to login');
        // Clear storage before redirect to ensure clean state
        if (typeof window !== 'undefined') {
          const storageKeys = ['supabase.auth.token', 'sb-uxtdsiqlzhzrwqyozuho-auth-token'];
          storageKeys.forEach(key => {
            try {
              localStorage.removeItem(key);
              sessionStorage.removeItem(key);
            } catch (e) {
              console.log('Storage clear error:', e);
            }
          });
        }
        router.push("/login");
      }
    }, 10000); // 10 second timeout

    supabase.auth.getUser()
      .then(({ data: { user }, error }) => {
        if (!mounted) return;

        clearTimeout(authTimeout);

        if (error) {
          // Only log if it's not the expected "Auth session missing" error
          if (error.message !== 'Auth session missing!') {
            console.error('Auth error:', error);
          }
          // Clear storage on auth error before redirecting (except for normal "no session")
          if (error.message !== 'Auth session missing!' && typeof window !== 'undefined') {
            const storageKeys = ['supabase.auth.token', 'sb-uxtdsiqlzhzrwqyozuho-auth-token'];
            storageKeys.forEach(key => {
              try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
              } catch (e) {
                console.log('Storage clear error:', e);
              }
            });
          }
          router.push("/login");
          return;
        }

        if (!user) {
          router.push("/login");
        } else {
          setUser(user);
          loadUserProfile(user.id);
          loadUserBalance(user.id);
          loadTournamentMessages();
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        clearTimeout(authTimeout);
        // Only log if it's not the expected "Auth session missing" error
        if (err?.message !== 'Auth session missing!') {
          console.error('Auth check failed:', err);
        }
        // Clear storage on error before redirecting (except for normal "no session")
        if (err?.message !== 'Auth session missing!' && typeof window !== 'undefined') {
          const storageKeys = ['supabase.auth.token', 'sb-uxtdsiqlzhzrwqyozuho-auth-token'];
          storageKeys.forEach(key => {
            try {
              localStorage.removeItem(key);
              sessionStorage.removeItem(key);
            } catch (e) {
              console.log('Storage clear error:', e);
            }
          });
        }
        router.push("/login");
      });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBookings() {
    if (!selectedSimulator || !selectedDate) return;

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("simulator", selectedSimulator)
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString())
      .order("start_time", { ascending: true });

    if (data) {
      console.log("Loaded bookings:", data);
      console.log("Current user ID:", user?.id);

      // Fetch guest fee transactions for these bookings
      const bookingIds = data.map((b) => b.id);
      const { data: transactions } = await supabase
        .from("user_transactions")
        .select("id, booking_id, amount")
        .in("booking_id", bookingIds)
        .eq("type", "guest_fee");

      // Group transactions by booking_id
      const transactionsByBooking: { [key: number]: any[] } = {};
      transactions?.forEach((t) => {
        if (!transactionsByBooking[t.booking_id]) {
          transactionsByBooking[t.booking_id] = [];
        }
        transactionsByBooking[t.booking_id].push(t);
      });

      // Fetch profiles for bookings if user is admin
      if (userProfile?.role === "admin" && data.length > 0) {
        const userIds = [...new Set(data.map((b) => b.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        // Attach profiles and guest transactions to bookings
        const bookingsWithProfiles = data.map((booking) => ({
          ...booking,
          profile: profiles?.find((p) => p.id === booking.user_id),
          guest_transactions: transactionsByBooking[booking.id] || [],
        }));
        setBookings(bookingsWithProfiles as Booking[]);
      } else {
        // Attach guest transactions to bookings
        const bookingsWithGuestInfo = data.map((booking) => ({
          ...booking,
          guest_transactions: transactionsByBooking[booking.id] || [],
        }));
        setBookings(bookingsWithGuestInfo as Booking[]);
      }
    }

    await loadUserTotalHours();
  }

  async function loadUserTotalHours() {
    if (!user) return;

    const now = new Date().toISOString();
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .gte("end_time", now);

    setUserTotalBookedHours(data?.length || 0);
  }

  useEffect(() => {
    if (selectedSimulator) {
      loadBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSimulator, selectedDate]);

  function selectSimulator(simulator: Simulator) {
    setSelectedSimulator(simulator);
    setSelectedDate(getMSTNow());
    setSelectedSlots([]);
    setError(null);
    setSuccess(null);
  }

  function clearSimulatorSelection() {
    setSelectedSimulator(null);
    setSelectedSlots([]);
    setBookings([]);
    setError(null);
    setSuccess(null);
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlots([]);
    setError(null);
    setSuccess(null);
  }

  function getTimeSlots(): Date[] {
    const slots: Date[] = [];
    const date = new Date(selectedDate);

    // Generate slots from 6 AM to 2 AM (next day)
    // hour 24 = midnight (12 AM), hour 25 = 1 AM, hour 26 = 2 AM
    for (let hour = 6; hour < 26; hour++) {
      const slot = new Date(date);
      slot.setHours(hour, 0, 0, 0);
      slots.push(slot);
    }

    return slots;
  }

  function toggleSlotSelection(timeSlot: Date) {
    const isBooked = bookings.some(
      (b) => new Date(b.start_time).getTime() === timeSlot.getTime()
    );

    if (isBooked) return;

    const isSelected = selectedSlots.some(
      (s) => s.getTime() === timeSlot.getTime()
    );

    if (isSelected) {
      setSelectedSlots(
        selectedSlots.filter((s) => s.getTime() !== timeSlot.getTime())
      );
    } else if (userTotalBookedHours + selectedSlots.length < 2) {
      setSelectedSlots([...selectedSlots, timeSlot]);
    } else {
      const remainingHours = 2 - userTotalBookedHours;
      setError(
        `You can only book a total of 2 hours. You currently have ${userTotalBookedHours} hour(s) booked and
  ${remainingHours} hour(s) remaining.`
      );
    }
  }

  async function bookSelectedSlots() {
    if (selectedSlots.length === 0 || !selectedSimulator) return;

    setError(null);
    setSuccess(null);

    let successCount = 0;

    for (const slot of selectedSlots) {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulator: selectedSimulator,
          start_time: slot.toISOString(),
        }),
      });

      if (response.ok) {
        successCount++;
      }
    }

    if (successCount > 0) {
      setSuccess(`Successfully booked ${successCount} time slot(s)!`);
      setSelectedSlots([]);
      await loadBookings();
    } else {
      setError(
        "Unable to book the selected time slots. They may already be booked or you may have reached your total limit of 2 hours."
      );
    }
  }

  async function cancelBooking(bookingId: number) {
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/bookings?id=${bookingId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setSuccess("Booking cancelled successfully!");
      await loadBookings();
    } else {
      setError("Unable to cancel this booking.");
    }
  }

  async function addGuestFee(bookingId: number, userId: string) {
    setAddingGuestFee(bookingId);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          bookingId,
          type: "guest_fee",
          amount: 20,
          description: "Guest fee",
        }),
      });

      if (response.ok) {
        setSuccess("Guest fee ($20) added successfully!");
        setTimeout(() => setSuccess(null), 3000);
        // Reload bookings to show the guest indicator
        await loadBookings();
        // Reload user balance if it's the current user
        if (user && userId === user.id) {
          await loadUserBalance(user.id);
        }
      } else {
        setError("Failed to add guest fee");
      }
    } catch (err) {
      setError("Failed to add guest fee");
    } finally {
      setAddingGuestFee(null);
    }
  }

  async function removeGuestFee(transactionId: number, userId: string) {
    try {
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Guest fee removed successfully!");
        setTimeout(() => setSuccess(null), 3000);
        // Reload bookings to update the guest indicators
        await loadBookings();
        // Reload user balance if it's the current user
        if (user && userId === user.id) {
          await loadUserBalance(user.id);
        }
      } else {
        setError("Failed to remove guest fee");
      }
    } catch (err) {
      setError("Failed to remove guest fee");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!selectedSimulator) {
    return (
      <>
        {/* Background Image */}
        <div
          className="fixed top-0 left-0 w-full h-full opacity-30 -z-10"
          style={{
            backgroundImage: "url('/images/golf-simulator-bg.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div className="min-h-screen py-12 relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-4 text-center text-gray-100">
                Welcome to The Cave Golf Schedule
              </h1>
              <p className="text-xl text-gray-400 mb-8 text-center">
                Select a simulator to view and book your time slots
              </p>

              <div className="grid md:grid-cols-2 gap-8 mt-12">
                <button
                  onClick={() => selectSimulator("east")}
                  className="bg-blue-900 hover:bg-blue-800 text-gray-100 rounded-lg p-12 text-center
    transition-transform hover:scale-105 shadow-lg border border-blue-700"
                >
                  <div className="text-6xl mb-4">📍</div>
                  <h3 className="text-3xl font-bold">EAST SIM</h3>
                </button>

                <button
                  onClick={() => selectSimulator("west")}
                  className="bg-green-900 hover:bg-green-800 text-gray-100 rounded-lg p-12 text-center
    transition-transform hover:scale-105 shadow-lg border border-green-700"
                >
                  <div className="text-6xl mb-4">📍</div>
                  <h3 className="text-3xl font-bold">WEST SIM</h3>
                </button>
              </div>

              {/* Active Membership Status */}
              {userProfile?.active_until && (
                <div className="mt-8">
                  {(() => {
                    const activeUntil = new Date(userProfile.active_until);
                    const isActive = activeUntil > new Date();
                    const daysRemaining = Math.ceil((activeUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

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

                    return isActive ? (
                      <div className={`border-l-4 px-4 py-2 rounded-r-lg shadow-md text-center ${
                        daysRemaining <= 30
                          ? "bg-yellow-900/30 border-yellow-600"
                          : "bg-green-900/30 border-green-600"
                      }`}>
                        <p className={`text-sm ${
                          daysRemaining <= 30 ? "text-yellow-100" : "text-green-100"
                        }`}>
                          Active until <span className="font-bold">{formatDateWithOrdinal(activeUntil)}</span>
                          {daysRemaining <= 30 && <span className="ml-2 text-yellow-300">({daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining)</span>}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-red-900/50 border-l-4 border-red-600 px-4 py-2 rounded-r-lg shadow-md text-center">
                        <p className="text-sm text-red-100">
                          Membership expired on <span className="font-bold">{formatDateWithOrdinal(activeUntil)}</span> - Please renew to continue booking
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Guest Fees Balance */}
              {userBalance > 0 && (
                <div className="mt-8">
                  <div className="bg-red-900/50 border-l-4 border-red-600 p-6 rounded-r-lg shadow-md text-center">
                    <h3 className="text-xl font-semibold text-red-200 mb-2">
                      Guest Fees Due
                    </h3>
                    <p className="text-3xl font-bold text-red-100 mb-3">
                      ${userBalance.toFixed(2)}
                    </p>
                    <p className="text-sm text-red-200">
                      Please send e-transfer to <span className="font-semibold">golfthecave@gmail.com</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Tournament Messages */}
              {tournamentMessages.filter(msg => msg.is_active).length > 0 && (
                <div className="mt-12">
                  <div className="space-y-4">
                    {tournamentMessages.filter(msg => msg.is_active).map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-yellow-900/30 border-l-4 border-yellow-600 p-4 rounded-r-lg shadow-md"
                      >
                        <div
                          className="text-gray-200 text-lg tournament-message"
                          dangerouslySetInnerHTML={{ __html: msg.message }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const timeSlots = getTimeSlots();
  const mstNow = getMSTNow();
  const isToday = selectedDate.toDateString() === mstNow.toDateString();

  return (
    <>
      {/* Background Image */}
      <div
        className="fixed top-0 left-0 w-full h-full opacity-30 -z-10"
        style={{
          backgroundImage: "url('/images/golf-simulator-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="min-h-screen py-8 relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={clearSimulatorSelection}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded"
              >
                ← Back to Simulator Selection
              </button>
              <h2 className="text-3xl font-bold text-gray-100">
                {selectedSimulator.toUpperCase()} SIM
              </h2>
              <div className="w-48"></div>
            </div>

            {/* Date Picker */}
            <div className="mb-6">
              {/* Admin Navigation Controls */}
              {userProfile?.role === "admin" && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 7);
                      selectDate(newDate);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-2 rounded"
                  >
                    ← Previous Week
                  </button>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 7);
                      selectDate(newDate);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-2 rounded"
                  >
                    Next Week →
                  </button>
                  <input
                    type="date"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value + 'T12:00:00');
                      selectDate(newDate);
                    }}
                    className="bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2 ml-2"
                  />
                  <button
                    onClick={() => selectDate(getMSTNow())}
                    className="bg-green-800 hover:bg-green-700 text-gray-100 px-3 py-2 rounded"
                  >
                    Today
                  </button>
                </div>
              )}

              {/* Date Buttons */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                  // For admins, center the week around selected date
                  // For users, show current week only
                  let baseDate;
                  if (userProfile?.role === "admin") {
                    baseDate = new Date(selectedDate);
                    baseDate.setHours(0, 0, 0, 0);
                    // Start from 3 days before selected date
                    baseDate.setDate(baseDate.getDate() - 3 + dayOffset);
                  } else {
                    const mstToday = getMSTNow();
                    mstToday.setHours(0, 0, 0, 0);
                    baseDate = new Date(mstToday);
                    baseDate.setDate(baseDate.getDate() + dayOffset);
                  }

                  const date = baseDate;
                  const isSelected =
                    date.toDateString() === selectedDate.toDateString();
                  const mstToday = getMSTNow();
                  mstToday.setHours(0, 0, 0, 0);
                  const isTodayBadge = date.toDateString() === mstToday.toDateString();

                  return (
                    <button
                      key={dayOffset}
                      onClick={() => selectDate(date)}
                      className={`shrink-0 min-w-[100px] p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "bg-blue-900 text-gray-100 border-blue-700 font-bold"
                          : "bg-gray-800 text-gray-300 border-gray-600 hover:border-blue-700"
                      }`}
                    >
                      <div className="text-sm font-semibold uppercase">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className="text-lg mt-1">
                        {date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      {isTodayBadge && (
                        <div
                          className={`text-xs mt-2 px-2 py-1 rounded ${
                            isSelected
                              ? "bg-gray-700 text-blue-300"
                              : "bg-green-800 text-gray-100"
                          }`}
                        >
                          Today
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend and Actions */}
            <div className="mb-4 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-gray-700 text-gray-200 rounded text-sm border border-gray-600">
                  Available
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-900 text-gray-100 rounded text-sm border border-blue-700">
                  Booked
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-900 text-gray-100 rounded text-sm border border-green-700">
                  Your Booking
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl" style={{ filter: 'grayscale(100%) brightness(2.5)' }}>👤</span>
                <span className="text-gray-300 text-sm">= Guest (click to remove)</span>
              </div>
              <div className="ml-auto font-bold text-gray-200">
                Your Total Bookings: {userTotalBookedHours} / 2 hours
              </div>
            </div>

            {/* Guest Fee Info Note */}
            <div className="mb-4 bg-blue-900/30 border border-blue-700 text-blue-200 px-4 py-2 rounded text-sm">
              <strong>💡 Guest Fee Info:</strong> Only click the "Guest +$20" button once per visit, not for each hour slot you've booked.
            </div>

            {/* Messages and Actions - Combined fixed height area */}
            <div className="mb-4 space-y-3" style={{ minHeight: '116px' }}>
              {/* Alerts */}
              {error && (
                <div
                  className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded flex
  justify-between items-center"
                >
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
                <div
                  className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded flex
  justify-between items-center"
                >
                  <span>{success}</span>
                  <button
                    onClick={() => setSuccess(null)}
                    className="text-green-200 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Selected slots action bar */}
              {selectedSlots.length > 0 && (
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-200">
                    Selected: {selectedSlots.length} hour(s)
                  </span>
                  <button
                    onClick={bookSelectedSlots}
                    className="bg-green-800 hover:bg-green-700 text-gray-100 px-4 py-2 rounded"
                  >
                    Book Selected Times
                  </button>
                  <button
                    onClick={() => setSelectedSlots([])}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Time Slots */}
            <div className="space-y-2">
              {timeSlots.map((timeSlot) => {
                const slotEndTime = new Date(timeSlot);
                slotEndTime.setHours(slotEndTime.getHours() + 1);

                // Only hide past slots for non-admin users
                const isPastSlot = isToday && slotEndTime <= mstNow;
                if (isPastSlot && userProfile?.role !== "admin") return null;

                const booking = bookings.find(
                  (b) => new Date(b.start_time).getTime() === timeSlot.getTime()
                );
                const isBooked = !!booking;
                const isUserBooking =
                  isBooked && user && booking.user_id === user.id;
                const isSelected = selectedSlots.some(
                  (s) => s.getTime() === timeSlot.getTime()
                );

                return (
                  <div
                    key={timeSlot.getTime()}
                    onClick={() => !isBooked && !isPastSlot && toggleSlotSelection(timeSlot)}
                    className={`p-4 rounded-lg border-2 transition-all flex justify-between items-center ${
                      isPastSlot
                        ? "bg-gray-800 border-gray-700 opacity-50 text-gray-500"
                        : isUserBooking
                        ? "bg-green-900/40 border-green-700 cursor-pointer text-gray-200"
                        : isBooked
                        ? "bg-blue-900/40 border-blue-700 cursor-default text-gray-200"
                        : isSelected
                        ? "bg-yellow-900/40 border-yellow-600 border-4 cursor-pointer text-gray-200"
                        : "bg-gray-800 border-gray-600 hover:border-green-700 cursor-pointer text-gray-200"
                    }`}
                  >
                    <div className="font-bold text-lg">
                      {timeSlot.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}{" "}
                      -{" "}
                      {slotEndTime.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </div>

                    <div className="flex items-center gap-3">
                      {isBooked ? (
                        <>
                          {isUserBooking ? (
                            <>
                              {booking.guest_transactions && booking.guest_transactions.length > 0 && (
                                <div className="flex gap-1">
                                  {booking.guest_transactions.map((transaction) => (
                                    <button
                                      key={transaction.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeGuestFee(transaction.id, booking.user_id);
                                      }}
                                      className="text-2xl hover:opacity-60 transition-opacity"
                                      style={{ filter: 'grayscale(100%) brightness(2.5)' }}
                                      title="Click to remove this guest ($20)"
                                    >
                                      👤
                                    </button>
                                  ))}
                                </div>
                              )}
                              <span className="px-3 py-1 bg-green-800 text-gray-100 rounded text-sm border border-green-700">
                                Your Booking
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addGuestFee(booking.id, booking.user_id);
                                }}
                                disabled={addingGuestFee === booking.id}
                                className="bg-purple-800 hover:bg-purple-700 text-gray-100 px-3 py-1 rounded text-sm disabled:opacity-50"
                              >
                                {addingGuestFee === booking.id ? "Adding..." : "Guest +$20"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelBooking(booking.id);
                                }}
                                className="bg-red-800 hover:bg-red-700 text-gray-100 px-3 py-1 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : userProfile?.role === "admin" ? (
                            <>
                              {booking.guest_transactions && booking.guest_transactions.length > 0 && (
                                <div className="flex gap-1">
                                  {booking.guest_transactions.map((transaction) => (
                                    <button
                                      key={transaction.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeGuestFee(transaction.id, booking.user_id);
                                      }}
                                      className="text-2xl hover:opacity-60 transition-opacity"
                                      style={{ filter: 'grayscale(100%) brightness(2.5)' }}
                                      title="Click to remove this guest ($20)"
                                    >
                                      👤
                                    </button>
                                  ))}
                                </div>
                              )}
                              {(booking.profile as Profile)?.profile_picture_url && (
                                <img
                                  src={(booking.profile as Profile).profile_picture_url || ''}
                                  alt={(booking.profile as Profile)?.name || 'User'}
                                  className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border-2 border-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageUrl((booking.profile as Profile)?.profile_picture_url || null);
                                    setShowImageModal(true);
                                  }}
                                />
                              )}
                              <span className="px-3 py-1 bg-blue-900 text-gray-100 rounded text-sm border border-blue-700">
                                Booked by{" "}
                                {(booking.profile as Profile)?.name || "User"}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addGuestFee(booking.id, booking.user_id);
                                }}
                                disabled={addingGuestFee === booking.id}
                                className="bg-purple-800 hover:bg-purple-700 text-gray-100 px-3 py-1 rounded text-sm disabled:opacity-50"
                              >
                                {addingGuestFee === booking.id ? "Adding..." : "Guest +$20"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelBooking(booking.id);
                                }}
                                className="bg-red-800 hover:bg-red-700 text-gray-100 px-3 py-1 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <span className="px-3 py-1 bg-blue-900 text-gray-100 rounded text-sm border border-blue-700">
                              Booked
                            </span>
                          )}
                        </>
                      ) : isSelected ? (
                        <span className="px-3 py-1 bg-yellow-800 text-gray-100 rounded text-sm border border-yellow-700">
                          Selected
                        </span>
                      ) : (
                        <span className="text-gray-400">Available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {showImageModal && selectedImageUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 bg-gray-800 rounded-full w-8 h-8 flex items-center justify-center text-gray-200 hover:bg-gray-700 z-10 border border-gray-600"
            >
              ×
            </button>
            <img
              src={selectedImageUrl}
              alt="Profile picture"
              className="max-w-full max-h-[90vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
