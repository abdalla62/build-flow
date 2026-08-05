import React from 'react';
import { Link } from 'react-router-dom';
import { FiInbox, FiArrowLeft } from 'react-icons/fi';

const NotFound = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-in fade-in duration-200">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400 shadow-sm">
        <FiInbox className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        Page Not Found
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        Sorry, we couldn't find the page you are looking for. It might have been moved or doesn't exist.
      </p>
      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600 shadow-lg shadow-teal-700/20 transition-all"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
