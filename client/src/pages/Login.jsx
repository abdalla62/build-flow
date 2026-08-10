import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../utils/roleHome';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

const formVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 }
  }
};

const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 24 }
  }
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const loggedInUser = await login(data.email, data.password);
    setIsSubmitting(false);
    if (loggedInUser) {
      navigate(getRoleHomePath(loggedInUser.role));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Construction site background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/login-bg.png')" }}
          initial={{ scale: 1.06 }}
          animate={{ scale: 1.14 }}
          transition={{ duration: 30, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        />
        <div className="absolute inset-0 bg-slate-950/65" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 via-transparent to-amber-950/35" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/75 p-8 shadow-2xl backdrop-blur-xl"
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white shadow-md shadow-brand-primary/30"
            whileHover={{ scale: 1.08, rotate: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 16 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12.75a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5H3" />
            </svg>
          </motion.div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white">BuildFlow</h2>
          <p className="mt-1.5 text-sm text-slate-300">
            Construction Material Procurement System 
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-8 space-y-6"
          variants={formVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-semibold text-slate-200">
              Email Address
            </label>
            <div className="relative mt-1.5">
              <FiMail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="you@company.com"
                className={`w-full rounded-xl border ${
                  errors.email ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:ring-brand-primary'
                } bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-brand-primary focus:bg-slate-950/80`}
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
              <p className="mt-1 text-xs font-semibold text-red-400">{errors.email.message}</p>
            )}
          </motion.div>

          <motion.div variants={fieldVariants}>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-200">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-brand-primaryHover hover:text-teal-300 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <FiLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`w-full rounded-xl border ${
                  errors.password ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:ring-brand-primary'
                } bg-slate-950/60 py-2.5 pl-10 pr-12 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-brand-primary focus:bg-slate-950/80`}
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs font-semibold text-red-400">{errors.password.message}</p>
            )}
          </motion.div>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            variants={fieldVariants}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center rounded-xl bg-brand-primary py-3 text-sm font-bold text-white shadow-lg shadow-brand-primary/30 transition-colors hover:bg-brand-primaryHover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Sign In'
            )}
          </motion.button>
        </motion.form>

        <motion.p
          className="mt-6 text-center text-xs text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          Accounts are created by the Administrator. Contact your admin if you need access.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
