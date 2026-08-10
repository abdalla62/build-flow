import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiBriefcase, FiEye, FiEyeOff } from 'react-icons/fi';

const Register = () => {
  const { register: signup } = useAuth();
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
    const success = await signup(data.name, data.email, data.password, data.role);
    setIsSubmitting(false);
    if (success) {
      navigate('/');
    }
  };

  const enterpriseRoles = [
    'Site Engineer',
    'Project Manager',
    'Procurement Officer',
    'Supplier',
    'Accountant',
    'Delivery Staff',
    'Administrator'
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]" />

      {/* Register Card container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white shadow-md shadow-teal-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-9-4.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM6.75 13.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm0 6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm11.25-6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm0 6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM13.5 5.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm0 6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm0 6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Create Account</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Register to join the BuildFlow platform
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          
          {/* Name Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Full Name
            </label>
            <div className="relative mt-1.5">
              <FiUser className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="John Doe"
                className={`w-full rounded-xl border ${
                  errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-brand-primary dark:border-slate-800'
                } bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                {...register('name', { required: 'Name is required' })}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name.message}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <div className="relative mt-1.5">
              <FiMail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="john@company.com"
                className={`w-full rounded-xl border ${
                  errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-brand-primary dark:border-slate-800'
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
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative mt-1.5">
              <FiLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`w-full rounded-xl border ${
                  errors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-brand-primary dark:border-slate-800'
                } bg-slate-50 py-2.5 pl-10 pr-12 text-sm outline-none focus:border-brand-primary focus:bg-brand-card dark:bg-slate-950 dark:focus:bg-slate-900 transition-all`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.password.message}</p>
            )}
          </div>

          {/* Role Selection Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Enterprise Role
            </label>
            <div className="relative mt-1.5">
              <FiBriefcase className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-brand-primary focus:bg-brand-card dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900 transition-all"
                {...register('role', { required: 'Please select a role' })}
              >
                {enterpriseRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {errors.role && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.role.message}</p>
            )}
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-xl bg-brand-primary py-3 text-sm font-bold text-white hover:bg-brand-primaryHover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-lg shadow-teal-700/20"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-brand-primary hover:text-brand-primaryHover dark:text-brand-primaryHover hover:underline"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
