"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

interface NewUserForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "user" | "admin";
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [newUser, setNewUser] = useState<NewUserForm>({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "user",
  });

  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

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

      setCurrentUser(user);

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
      const data = await response.json();
      setUsers(data);
    } else {
      setError("Failed to load users");
    }
  }

  function openAddModal() {
    setShowAddModal(true);
    setNewUser({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "user",
    });
    setError(null);
  }

  function closeAddModal() {
    setShowAddModal(false);
    setNewUser({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "user",
    });
    setError(null);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("User created successfully!");
        await loadUsers();
        closeAddModal();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (err) {
      setError("An error occurred while creating the user");
    } finally {
      setIsProcessing(false);
    }
  }

  function openEditModal(user: Profile) {
    setEditUser(user);
    setShowEditModal(true);
    setSelectedFile(null);
    setError(null);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditUser(null);
    setSelectedFile(null);
    setError(null);
  }

  async function handleImageUpload(userId: string, file: File): Promise<string | null> {
    try {
      setUploadingImage(true);

      // Validate file size (max 10MB for high quality)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file size must be less than 10MB');
        return null;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('File must be an image');
        return null;
      }

      // Create a unique filename preserving original extension
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage without compression
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(`Failed to upload image: ${uploadError.message}`);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err: any) {
      console.error('Image upload error:', err);
      setError(`Failed to upload image: ${err.message}`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;

    setError(null);
    setIsProcessing(true);

    try {
      let profilePictureUrl = editUser.profile_picture_url;

      // Upload image if a new file was selected
      if (selectedFile) {
        const uploadedUrl = await handleImageUpload(editUser.id, selectedFile);
        if (uploadedUrl) {
          profilePictureUrl = uploadedUrl;
        } else {
          // Upload failed, don't proceed
          setIsProcessing(false);
          return;
        }
      }

      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUser.id,
          email: editUser.email,
          name: editUser.name,
          phone: editUser.phone,
          role: editUser.role,
          profile_picture_url: profilePictureUrl,
          active_until: editUser.active_until,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("User updated successfully!");
        await loadUsers();
        closeEditModal();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (err) {
      setError("An error occurred while updating the user");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("User deleted successfully!");
        await loadUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete user");
      }
    } catch (err) {
      setError("An error occurred while deleting the user");
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
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-100">User Management</h1>
            <button
              onClick={openAddModal}
              className="bg-blue-900 hover:bg-blue-800 text-gray-100 px-4 py-2 rounded border border-blue-700"
            >
              + Add New User
            </button>
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

          {/* Users Table */}
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Picture
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
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Active Until
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
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
                    const isActive = activeUntil && activeUntil > new Date();
                    const isExpired = activeUntil && activeUntil <= new Date();

                    return (
                      <tr key={user.id} className="hover:bg-gray-700 text-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.profile_picture_url ? (
                            <img
                              src={user.profile_picture_url}
                              alt={user.name || 'User'}
                              className="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setSelectedImageUrl(user.profile_picture_url);
                                setShowImageModal(true);
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
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
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              user.role === "admin"
                                ? "bg-red-900 text-red-200 border border-red-700"
                                : "bg-blue-900 text-blue-200 border border-blue-700"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {activeUntil ? (
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                isActive
                                  ? "bg-green-900 text-green-200 border border-green-700"
                                  : "bg-red-900 text-red-200 border border-red-700"
                              }`}
                            >
                              {activeUntil.toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-blue-400 hover:text-blue-300 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser?.id}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-100">Add New User</h2>
              <button
                onClick={closeAddModal}
                className="text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Phone</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) =>
                    setNewUser({ ...newUser, phone: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  placeholder="555-123-4567"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  minLength={6}
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-300">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      role: e.target.value as "user" | "admin",
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-blue-900 hover:bg-blue-800 text-gray-100 px-4 py-2 rounded disabled:opacity-50 border border-blue-700"
                >
                  {isProcessing ? "Creating..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-100">Edit User</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Name</label>
                <input
                  type="text"
                  value={editUser.name || ""}
                  onChange={(e) =>
                    setEditUser({ ...editUser, name: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Email</label>
                <input
                  type="email"
                  value={editUser.email || ""}
                  onChange={(e) =>
                    setEditUser({ ...editUser, email: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Phone</label>
                <input
                  type="tel"
                  value={editUser.phone || ""}
                  onChange={(e) =>
                    setEditUser({ ...editUser, phone: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                  placeholder="555-123-4567"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Profile Picture</label>
                {editUser.profile_picture_url && !selectedFile && (
                  <div className="mb-2">
                    <img
                      src={editUser.profile_picture_url}
                      alt="Current profile"
                      className="w-20 h-20 rounded object-cover border-2 border-gray-600"
                    />
                  </div>
                )}
                {selectedFile && (
                  <div className="mb-2">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="w-20 h-20 rounded object-cover border-2 border-gray-600"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Upload a new profile picture (JPG, PNG, GIF)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Role</label>
                <select
                  value={editUser.role}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      role: e.target.value as "user" | "admin",
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Active Until (Membership Expiry)
                </label>
                <input
                  type="date"
                  value={
                    editUser.active_until
                      ? new Date(editUser.active_until).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    const dateValue = e.target.value ? new Date(e.target.value).toISOString() : null;
                    setEditUser({ ...editUser, active_until: dateValue });
                  }}
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Set the date until which the user's membership is active (typically 1 year from payment)
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-blue-900 hover:bg-blue-800 text-gray-100 px-4 py-2 rounded disabled:opacity-50 border border-blue-700"
                >
                  {isProcessing ? "Updating..." : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {showImageModal && selectedImageUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 z-10"
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
    </div>
  );
}
