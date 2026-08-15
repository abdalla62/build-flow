import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiArrowLeft, FiCheckCircle, FiLock } from 'react-icons/fi';

const tokenFromResetUrl = (url) => {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/').filter(Boolean);
    const i = parts.indexOf('reset-password');
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
  } catch {
    return null;
  }
  return null;
};

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();

  const onSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const result = await forgotPassword(data.email);
    setIsSubmitting(false);
    if (!result) return;

    const token =
      typeof result === 'object' && result.resetUrl
        ? tokenFromResetUrl(result.resetUrl)
        : null;

    if (token) {
      navigate(`/reset-password/${token}`, { replace: true });
      return;
    }

    setIsSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950 transition-colors duration-200">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        {!isSubmitted ? (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <FiLock className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Recover Password
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Enter your email to continue and set a new password
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <FiMail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className={`w-full rounded-xl border ${
                      errors.email
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-200 focus:ring-brand-primary dark:border-slate-800'
                    } bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: 'Invalid email address'
                      }
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs font-semibold text-red-500">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-xl bg-brand-primary py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 transition-colors hover:bg-brand-primaryHover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400">
              <FiCheckCircle className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              Check Your Inbox
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              If an account exists for that email, we have sent instructions to reset your password.
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
