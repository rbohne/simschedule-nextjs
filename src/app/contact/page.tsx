"use client";

import { useEffect, useState } from "react";
import { createClient, getStoredSession, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

interface ContactForm {
  issueType: string;
  subject: string;
  message: string;
}

interface PhotoFile {
  file: File;
  preview: string;
}

export default function ContactPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoFile | null>(null);

  const [formData, setFormData] = useState<ContactForm>({
    issueType: "",
    subject: "",
    message: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const stored = getStoredSession();
    if (!stored?.user) {
      router.push('/login');
      return;
    }

    // Show the form immediately, then load full profile in background
    setLoading(false);

    // Load full profile for form pre-fill (uses Supabase client, may be slow on hard refresh)
    supabase
      .from("profiles")
      .select("*")
      .eq("id", stored.user.id)
      .single()
      .then(({ data: profile }) => {
        if (!mounted) return;
        if (profile) setCurrentUser(profile);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') router.push('/login');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be less than 5MB");
      return;
    }

    // Create preview
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhoto({
          file,
          preview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error loading photo");
    }
  }

  function removePhoto() {
    setSelectedPhoto(null);
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `contact-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("contact-photos")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from("contact-photos")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      console.error("Error uploading photo:", err);
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsProcessing(true);

    try {
      // Upload photo if selected
      let photoUrl = null;
      if (selectedPhoto) {
        photoUrl = await uploadPhoto(selectedPhoto.file);
        if (!photoUrl) {
          setError("Failed to upload photo. Please try again.");
          setIsProcessing(false);
          return;
        }
      }

      const stored = getStoredSession()
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(stored?.access_token ? { "Authorization": `Bearer ${stored.access_token}` } : {}),
        },
        body: JSON.stringify({
          issue_type: formData.issueType,
          subject: formData.subject,
          message: formData.message,
          photo_url: photoUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(
          "Thank you! Your message has been sent successfully. We'll get back to you soon."
        );
        setFormData({
          issueType: "",
          subject: "",
          message: "",
        });
        removePhoto();
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch (err) {
      setError("An error occurred while sending your message");
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

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/images/TheCave_LOGO.png"
            alt="The Cave Golf"
            className="max-w-[200px] h-auto"
          />
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700">
            <div className="bg-gray-900 text-gray-100 px-6 py-4 rounded-t-lg border-b border-gray-700">
              <h1 className="text-2xl font-bold mb-0">
                Contact Us / Report an Issue
              </h1>
            </div>

            <div className="p-6">
              <p className="text-gray-400 mb-6">
                Have a question, found a bug, or need to report an issue? Send
                us a message and we'll get back to you as soon as possible.
              </p>

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
                <div className="mb-4 bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded flex justify-between items-center">
                  <span>{success}</span>
                  <button
                    onClick={() => setSuccess(null)}
                    className="text-green-700 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* User Info Display */}
              <div className="mb-6 p-4 bg-gray-700 rounded border border-gray-600">
                <p className="text-sm text-gray-400 mb-1">Submitting as:</p>
                <p className="text-gray-200">
                  {currentUser?.name} • {currentUser?.email} •{" "}
                  {currentUser?.phone}
                </p>
              </div>

              {/* Contact Form */}
              <form onSubmit={handleSubmit}>
                {/* Issue Type */}
                <div className="mb-4">
                  <label
                    htmlFor="issueType"
                    className="block text-sm font-medium mb-2"
                  >
                    Issue Type
                  </label>
                  <select
                    id="issueType"
                    value={formData.issueType}
                    onChange={(e) =>
                      setFormData({ ...formData, issueType: e.target.value })
                    }
                    className="w-full border border-gray-600 rounded px-3 py-2 bg-gray-700 text-gray-100"
                    required
                  >
                    <option value="">-- Select Type --</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Booking Issue">Booking Issue</option>
                    <option value="Account Issue">Account Issue</option>
                    <option value="General Question">General Question</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Subject */}
                <div className="mb-4">
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium mb-2"
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="Brief description of your issue"
                    maxLength={200}
                    required
                  />
                </div>

                {/* Message */}
                <div className="mb-4">
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium mb-2"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    rows={6}
                    placeholder="Please provide details about your issue or question..."
                    maxLength={2000}
                    required
                  />
                </div>

                {/* Photo Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    📷 Attach Photo (Optional)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <label
                      htmlFor="photoCamera"
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded cursor-pointer"
                    >
                      📷 Take Photo
                    </label>
                    <label
                      htmlFor="photoGallery"
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded cursor-pointer"
                    >
                      🖼️ Choose from Gallery
                    </label>
                  </div>
                  <input
                    type="file"
                    id="photoCamera"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelected}
                    className="hidden"
                  />
                  <input
                    type="file"
                    id="photoGallery"
                    accept="image/*"
                    onChange={handlePhotoSelected}
                    className="hidden"
                  />
                  <small className="text-gray-500">
                    You can take a photo or choose an existing one (max 5MB)
                  </small>

                  {selectedPhoto && (
                    <div className="mt-3">
                      <p className="font-medium mb-2">Photo Preview:</p>
                      <div className="relative inline-block">
                        <img
                          src={selectedPhoto.preview}
                          alt="Preview"
                          className="max-w-full max-h-64 rounded border border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-medium disabled:opacity-50"
                  >
                    {isProcessing ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center mt-6">
            <button
              onClick={() => router.push("/")}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
