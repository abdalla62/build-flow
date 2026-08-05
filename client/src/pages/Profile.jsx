import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiKey, FiSave, FiCamera } from 'react-icons/fi';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    if (!avatarFile && !removeAvatar) {
      setAvatarPreview(user?.avatar || '');
    }
  }, [user?.avatar, avatarFile, removeAvatar]);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors }
  } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || ''
    }
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    watch: watchPassword,
    formState: { errors: passwordErrors }
  } = useForm();

  const watchNewPassword = watchPassword('newPassword');

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onProfileSubmit = async (data) => {
    setProfileSubmitting(true);
    const ok = await updateProfile(
      String(data.name || '').trim(),
      String(data.email || '').trim(),
      avatarFile,
      removeAvatar
    );
    if (ok) {
      setAvatarFile(null);
      setRemoveAvatar(false);
    }
    setProfileSubmitting(false);
  };

  const onPasswordSubmit = async (data) => {
    if (!data.currentPassword?.trim() || !data.newPassword?.trim()) {
      return;
    }
    setPasswordSubmitting(true);
    const success = await changePassword(data.currentPassword, data.newPassword);
    setPasswordSubmitting(false);
    if (success) {
      resetPasswordForm();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal information and password preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Form 1: Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400">
              <FiUser className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-950 dark:text-white">Personal Information</h3>
              <p className="text-xs text-slate-500">Update your account name and email address</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">Profile Photo</label>
              <div className="mt-2 flex items-center gap-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full object-cover border-2 border-teal-500/40"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center text-xl font-bold border border-teal-500/30">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <FiCamera className="h-4 w-4" />
                    Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarPreview('');
                        setAvatarFile(null);
                        setRemoveAvatar(true);
                      }}
                      className="block mt-1.5 text-[11px] font-semibold text-red-500"
                    >
                      Remove photo
                    </button>
                  )}
                  <p className="mt-1 text-[10px] text-slate-400">JPG/PNG, max 2MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">Full Name</label>
              <div className="relative mt-1.5">
                <FiUser className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Your Name"
                  className={`w-full rounded-xl border ${
                    profileErrors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                  {...registerProfile('name', {
                    required: 'Full name is required',
                    validate: (v) => String(v || '').trim().length >= 2 || 'Full name is required (min 2 characters)'
                  })}
                />
              </div>
              {profileErrors.name && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{profileErrors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">Email Address</label>
              <div className="relative mt-1.5">
                <FiMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  className={`w-full rounded-xl border ${
                    profileErrors.email ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                  {...registerProfile('email', {
                    required: 'Email is required',
                    validate: (v) => {
                      const e = String(v || '').trim();
                      if (!e) return 'Email is required';
                      if (!/^\S+@\S+\.\S+$/.test(e)) return 'Invalid email address';
                      return true;
                    }
                  })}
                />
              </div>
              {profileErrors.email && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{profileErrors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">System Role</label>
              <input
                type="text"
                disabled
                value={user?.role || ''}
                className="w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-100 py-2.5 px-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={profileSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition-colors disabled:opacity-50"
            >
              {profileSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <FiSave className="h-4 w-4" />
                  Save Details
                </>
              )}
            </button>
          </form>
        </div>

        {/* Form 2: Password Change */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <FiKey className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-950 dark:text-white">Security Settings</h3>
              <p className="text-xs text-slate-500">Change your login password credentials</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">Current Password</label>
              <div className="relative mt-1.5">
                <FiLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`w-full rounded-xl border ${
                    passwordErrors.currentPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                  {...registerPassword('currentPassword', { required: 'Current password is required' })}
                />
              </div>
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">New Password</label>
              <div className="relative mt-1.5">
                <FiLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`w-full rounded-xl border ${
                    passwordErrors.newPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                  {...registerPassword('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                />
              </div>
              {passwordErrors.newPassword && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase dark:text-slate-400">Confirm New Password</label>
              <div className="relative mt-1.5">
                <FiLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`w-full rounded-xl border ${
                    passwordErrors.confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  } bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                  {...registerPassword('confirmPassword', {
                    required: 'Confirm password is required',
                    validate: (v) => v === watchNewPassword || 'Passwords do not match'
                  })}
                />
              </div>
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500 font-semibold">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={passwordSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition-colors disabled:opacity-50"
            >
              {passwordSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <FiKey className="h-4 w-4" />
                  Change Password
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
