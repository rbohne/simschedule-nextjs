"use client";

import { useEffect, useState } from "react";
import type { Simulator, Booking } from "@/types/database";

// MST is UTC-7
const MST_OFFSET = -7;

function convertToMST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * MST_OFFSET);
}

function getMSTNow(): Date {
  return convertToMST(new Date());
}

export default function DisplayPage() {
  const [eastBookings, setEastBookings] = useState<Booking[]>([]);
  const [westBookings, setWestBookings] = useState<Booking[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  // Fix hydration by only using MST time after mount
  useEffect(() => {
    setMounted(true);
    setCurrentTime(getMSTNow());
    setLastUpdate(getMSTNow());
  }, []);

  async function loadBookings(simulator: Simulator) {
    const today = getMSTNow();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    console.log(`[Display] Loading bookings for ${simulator}:`, {
      date: startOfDay.toISOString(),
    });

    try {
      const response = await fetch(
        `/api/bookings-display?simulator=${simulator}&date=${startOfDay.toISOString()}`
      );

      if (!response.ok) {
        console.error(`[Display] Error loading ${simulator} bookings:`, response.statusText);
        return [];
      }

      const data = await response.json();
      console.log(`[Display] Loaded ${data?.length || 0} bookings for ${simulator}`);
      return data || [];
    } catch (error) {
      console.error(`[Display] Error loading ${simulator} bookings:`, error);
      return [];
    }
  }

  async function refreshBookings() {
    const [east, west] = await Promise.all([
      loadBookings("east"),
      loadBookings("west"),
    ]);
    setEastBookings(east);
    setWestBookings(west);
    setLastUpdate(getMSTNow());
  }

  useEffect(() => {
    // Initial load
    refreshBookings();

    // Refresh every 1 minute
    const refreshInterval = setInterval(refreshBookings, 60000);

    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(getMSTNow());
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(timeInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getTimeSlots(): Date[] {
    const slots: Date[] = [];
    const date = getMSTNow();
    date.setHours(0, 0, 0, 0);

    // Generate slots from 6 AM to 2 AM (next day)
    for (let hour = 6; hour < 26; hour++) {
      const slot = new Date(date);
      slot.setHours(hour, 0, 0, 0);
      slots.push(slot);
    }

    return slots;
  }

  function getFirstName(fullName: string | null | undefined): string {
    if (!fullName) return "Unknown";
    return fullName.split(" ")[0];
  }

  function renderSimulator(simulator: Simulator, bookings: Booking[]) {
    const timeSlots = getTimeSlots();
    const now = getMSTNow();

    return (
      <div className="flex-1 p-6">
        {/* Simulator Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 text-center">
          <h2 className="text-4xl font-bold text-gray-100 uppercase">
            {simulator} Simulator
          </h2>
        </div>

        {/* Time Slots */}
        <div className="space-y-3">
          {timeSlots.map((timeSlot) => {
            const slotEndTime = new Date(timeSlot);
            slotEndTime.setHours(slotEndTime.getHours() + 1);

            // Check if this time slot falls within any booking
            const booking = bookings.find((b) => {
              const bookingStart = new Date(b.start_time).getTime();
              const bookingEnd = new Date(b.end_time).getTime();
              const slotTime = timeSlot.getTime();
              return slotTime >= bookingStart && slotTime < bookingEnd;
            });

            const isBooked = !!booking;
            const isPast = slotEndTime <= now;
            const isCurrent =
              timeSlot.getTime() <= now.getTime() &&
              slotEndTime.getTime() > now.getTime();
            const isFirstHourOfBooking =
              booking && new Date(booking.start_time).getTime() === timeSlot.getTime();

            return (
              <div
                key={timeSlot.getTime()}
                className={`p-4 rounded-lg border-2 flex justify-between items-center ${
                  isPast
                    ? "bg-gray-900 border-gray-800 opacity-40"
                    : isCurrent
                    ? "bg-yellow-900/40 border-yellow-600 border-4"
                    : isBooked
                    ? "bg-blue-900/40 border-blue-700"
                    : "bg-gray-800 border-gray-600"
                }`}
              >
                <div className="text-xl font-bold text-gray-200">
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

                <div>
                  {isBooked && isFirstHourOfBooking ? (
                    <div className="flex items-center gap-3">
                      {booking.profile?.profile_picture_url && (
                        <img
                          src={booking.profile.profile_picture_url}
                          alt={booking.profile.name || "User"}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <span className="text-xl font-semibold text-gray-100">
                        {getFirstName(booking.profile?.name)} (2 hours)
                      </span>
                    </div>
                  ) : isBooked ? (
                    <span className="text-lg text-gray-400 italic">
                      (hour 2 of booking)
                    </span>
                  ) : (
                    <span className="text-xl text-gray-400">Available</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-100 text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header Bar */}
      <div className="bg-gray-800 border-b-2 border-gray-700 p-6">
        <div className="max-w-full mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">
              The Cave Golf - Live Bookings
            </h1>
            <p className="text-gray-400 mt-1">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-100">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Last updated:{" "}
              {lastUpdate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-Side Simulators */}
      <div className="flex">
        {/* East Simulator */}
        {renderSimulator("east", eastBookings)}

        {/* Divider */}
        <div className="w-1 bg-gray-700"></div>

        {/* West Simulator */}
        {renderSimulator("west", westBookings)}
      </div>
    </div>
  );
}
