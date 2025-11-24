"use client";

import { useEffect, useState, useRef } from "react";
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
  const [userTotalBookedHours, setUserTotalBookedHours] = useState(0); // Actually counts bookings now (1 booking = 2 hours)
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tournamentMessages, setTournamentMessages] = useState<TournamentMessage[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [addingGuestFee, setAddingGuestFee] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const comboboxRef = useRef<HTMLDivElement>(null);
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
        console.log('[Auth] Including auth token in headers');
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        console.warn('[Auth] No session found, cannot add auth headers');
      }
    } catch (e) {
      console.error('[Auth] Failed to get session:', e);
    }

    return headers;
  }

  async function loadUserProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    console.log('[Home] User profile loaded:', data);

    if (data) {
      setUserProfile(data);
      console.log('[Home] User role:', data.role, 'isAdmin:', data.role === 'admin');
      // Load all users if admin
      if (data.role === 'admin') {
        loadAllUsers();
      }
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
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/transactions?userId=${userId}`, {
        headers
      });
      if (response.ok) {
        const transactions = await response.json();

        // Store transactions for details modal (only guest fees)
        const guestFeeTransactions = transactions.filter((t: any) => t.type === 'guest_fee');
        setUserTransactions(guestFeeTransactions);

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

  async function loadAllUsers() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/users', {
        headers
      });
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
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

    // Count total bookings (each booking is 2 hours)
    setUserTotalBookedHours(data?.length || 0);
  }

  useEffect(() => {
    if (selectedSimulator) {
      loadBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSimulator, selectedDate]);

  // Handle clicks outside the combobox to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserDropdown]);

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
    // Check if this slot or the next hour is already booked
    const nextHourSlot = new Date(timeSlot);
    nextHourSlot.setHours(nextHourSlot.getHours() + 1);

    const isStartSlotBooked = bookings.some(
      (b) => new Date(b.start_time).getTime() === timeSlot.getTime()
    );
    const isNextSlotBooked = bookings.some(
      (b) => new Date(b.start_time).getTime() === nextHourSlot.getTime()
    );

    if (isStartSlotBooked || isNextSlotBooked) {
      setError('Both the selected hour and the next hour must be available for a 2-hour booking.');
      return;
    }

    const isSelected = selectedSlots.some(
      (s) => s.getTime() === timeSlot.getTime()
    );

    if (isSelected) {
      // Deselect this slot
      setSelectedSlots([]);
      setError(null);
    } else if (userProfile?.role === 'admin' || userTotalBookedHours === 0) {
      // Admins can book unlimited slots, regular users can book 1 slot (which is 2 hours)
      setSelectedSlots([timeSlot]);
      setError(null);
    } else {
      setError(
        `You can only book 1 time slot (2 hours). You already have a booking.`
      );
    }
  }

  async function bookSelectedSlots() {
    if (selectedSlots.length === 0 || !selectedSimulator) return;

    setError(null);
    setSuccess(null);

    // Book the selected slot (which will automatically be 2 hours)
    const slot = selectedSlots[0];
    const bookingData: any = {
      simulator: selectedSimulator,
      start_time: slot.toISOString(),
    };

    // If admin is booking for another user, include the target user ID
    if (userProfile?.role === 'admin' && selectedUserId) {
      bookingData.targetUserId = selectedUserId;
    }

    const headers = await getAuthHeaders();
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers,
      body: JSON.stringify(bookingData),
    });

    if (response.ok) {
      const bookedForUser = allUsers.find(u => u.id === selectedUserId);
      const userName = bookedForUser ? bookedForUser.name : 'your';
      setSuccess(`Successfully booked ${userName === 'your' ? 'your' : userName + "'s"} 2-hour time slot!`);
      setSelectedSlots([]);
      setSelectedUserId(null); // Reset selection
      setUserSearchQuery(''); // Reset search
      setShowUserDropdown(false); // Hide dropdown
      await loadBookings();
    } else {
      const data = await response.json();
      setError(
        data.error || "Unable to book the selected time slot. It may already be booked or you may already have a booking."
      );
    }
  }

  async function cancelBooking(bookingId: number) {
    setError(null);
    setSuccess(null);

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/bookings?id=${bookingId}`, {
      method: "DELETE",
      headers,
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
      const headers = await getAuthHeaders();
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers,
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
                    <button
                      onClick={() => setShowTransactionsModal(true)}
                      className="bg-red-800 hover:bg-red-700 text-red-100 px-4 py-2 rounded text-sm mb-3 border border-red-600"
                    >
                      View Details
                    </button>
                    <p className="text-sm text-red-200">
                      Please send e-transfer to <span className="font-semibold">golfthecave@gmail.com</span>
                    </p>
                    {/* Guest Fee Transactions Modal */}
                    {showTransactionsModal && (
                      <div
                        id="guest-fee-modal"
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          width: '100vw',
                          height: '100vh',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '1rem',
                          zIndex: 99999
                        }}
                        onClick={() => setShowTransactionsModal(false)}
                      >
                        <div
                          style={{
                            backgroundColor: '#1f2937',
                            borderRadius: '0.5rem',
                            maxWidth: '42rem',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            border: '1px solid #374151'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: '#111827',
                            borderBottom: '1px solid #374151',
                            padding: '1rem 1.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f3f4f6', margin: 0 }}>
                              Guest Fee Details
                            </h2>
                            <button
                              onClick={() => setShowTransactionsModal(false)}
                              style={{ color: '#9ca3af', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              ×
                            </button>
                          </div>

                          <div style={{ padding: '1.5rem' }}>
                            {userTransactions.length === 0 ? (
                              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem 0' }}>No guest fee transactions found.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {userTransactions.map((transaction: any) => {
                                  const bookingDate = transaction.booking ? new Date(transaction.booking.start_time) : null;
                                  const transactionDate = new Date(transaction.created_at);

                                  return (
                                    <div
                                      key={transaction.id}
                                      style={{
                                        backgroundColor: '#374151',
                                        borderRadius: '0.25rem',
                                        padding: '1rem',
                                        border: '1px solid #4b5563'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                          {bookingDate && (
                                            <div style={{ color: '#e5e7eb', fontWeight: '500' }}>
                                              {bookingDate.toLocaleDateString("en-US", {
                                                weekday: "short",
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric"
                                              })}
                                              {" at "}
                                              {bookingDate.toLocaleTimeString("en-US", {
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true
                                              })}
                                            </div>
                                          )}
                                          {transaction.booking && (
                                            <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                                              {transaction.booking.simulator.charAt(0).toUpperCase() + transaction.booking.simulator.slice(1)} Simulator
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ color: '#f87171', fontWeight: 'bold', fontSize: '1.125rem' }}>
                                          +${parseFloat(transaction.amount).toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                <div style={{ borderTop: '1px solid #4b5563', paddingTop: '1rem', marginTop: '1rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#e5e7eb', fontWeight: '600' }}>Total Due:</span>
                                    <span style={{ color: '#f87171', fontWeight: 'bold', fontSize: '1.25rem' }}>${userBalance.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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
                Your Bookings: {userTotalBookedHours} {userProfile?.role === 'admin' ? '(unlimited)' : '/ 1 booking'} (2 hours each)
              </div>
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
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-bold text-gray-200">
                    Selected: 2 hours
                  </span>
                  {userProfile?.role === 'admin' && (
                    <div className="flex items-center gap-2 relative">
                      <label className="text-gray-200 text-sm font-medium">Book for:</label>
                      <div className="relative" ref={comboboxRef}>
                        <input
                          type="text"
                          value={
                            selectedUserId
                              ? allUsers.find(u => u.id === selectedUserId)?.name || ''
                              : userSearchQuery || 'Myself'
                          }
                          onChange={(e) => {
                            setUserSearchQuery(e.target.value);
                            setSelectedUserId(null);
                            setShowUserDropdown(true);
                          }}
                          onFocus={() => setShowUserDropdown(true)}
                          placeholder="Search or select user..."
                          className="bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2 text-sm w-64"
                        />
                        {showUserDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto z-50">
                            <button
                              onClick={() => {
                                setSelectedUserId(null);
                                setUserSearchQuery('');
                                setShowUserDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-600 text-gray-100 text-sm border-b border-gray-600"
                            >
                              Myself
                            </button>
                            {allUsers
                              .filter(u => u.id !== user?.id)
                              .filter(u => u.name && u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
                              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                              .map(u => (
                                <button
                                  key={u.id}
                                  onClick={() => {
                                    setSelectedUserId(u.id);
                                    setUserSearchQuery('');
                                    setShowUserDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-600 text-gray-100 text-sm"
                                >
                                  {u.name}
                                </button>
                              ))
                            }
                            {allUsers.filter(u => u.id !== user?.id && u.name && u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && userSearchQuery && (
                              <div className="px-3 py-2 text-gray-400 text-sm">
                                No users found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedUserId && (
                        <button
                          onClick={() => {
                            setSelectedUserId(null);
                            setUserSearchQuery('');
                          }}
                          className="text-gray-400 hover:text-gray-200 text-sm"
                          title="Clear selection"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    onClick={bookSelectedSlots}
                    className="bg-green-800 hover:bg-green-700 text-gray-100 px-4 py-2 rounded"
                  >
                    Book Selected Times
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSlots([]);
                      setSelectedUserId(null);
                      setUserSearchQuery('');
                      setShowUserDropdown(false);
                    }}
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

                // Check if this time slot falls within any booking (bookings are 2 hours long)
                const booking = bookings.find((b) => {
                  const bookingStart = new Date(b.start_time).getTime();
                  const bookingEnd = new Date(b.end_time).getTime();
                  const slotTime = timeSlot.getTime();
                  return slotTime >= bookingStart && slotTime < bookingEnd;
                });
                const isBooked = !!booking;
                const isUserBooking =
                  isBooked && user && booking.user_id === user.id;
                // Check if this slot is selected (either as the start hour or the second hour of a 2-hour selection)
                const isSelected = selectedSlots.some((s) => {
                  const selectedTime = s.getTime();
                  const nextHourTime = new Date(s).setHours(s.getHours() + 1);
                  return timeSlot.getTime() === selectedTime || timeSlot.getTime() === nextHourTime;
                });
                // Show which hour of the 2-hour booking this is
                const isFirstHourOfBooking = booking && new Date(booking.start_time).getTime() === timeSlot.getTime();

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
                              {isFirstHourOfBooking ? (
                                <>
                                  {/* Only show action buttons on the first hour of the 2-hour booking */}
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
                                    Your Booking (2 hours)
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
                                <span className="px-3 py-1 bg-green-800 text-gray-100 rounded text-sm border border-green-700">
                                  Your Booking (hour 2)
                                </span>
                              )}
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
