import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

const Modal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-brand-navy/45 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative z-10 w-full max-w-lg rounded-card border border-brand-border bg-brand-card p-6 shadow-bf dark:border-brand-darkBorder dark:bg-brand-darkCard"
          >
            <div className="mb-5 flex items-center justify-between border-b border-brand-border pb-3 dark:border-brand-darkBorder">
              <h3 className="text-lg font-bold text-brand-text dark:text-white">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-brand-muted transition-colors hover:bg-brand-bg hover:text-brand-text dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
