import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Users from './pages/Users';
import Projects from './pages/Projects';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Materials from './pages/Materials';
import MaterialRequests from './pages/MaterialRequests';
import Quotations from './pages/Quotations';
import PurchaseOrders from './pages/PurchaseOrders';
import Payments from './pages/Payments';
import Deliveries from './pages/Deliveries';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

const App = () => {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700',
          duration: 3500,
        }}
      />
      <Routes>
        {/* Public Authentication — login only (no public signup) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Dashboard Shell Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            
            {/* CRUD Resource Pages */}
            <Route path="/projects" element={<Projects />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/material-requests" element={<MaterialRequests />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route element={<ProtectedRoute allowedRoles={['Administrator', 'Accountant', 'Supplier']} />}>
              <Route path="/payments" element={<Payments />} />
            </Route>
            <Route path="/deliveries" element={<Deliveries />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />

            {/* Admin Only Route */}
            <Route element={<ProtectedRoute allowedRoles={['Administrator']} />}>
              <Route path="/users" element={<Users />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Route>

            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
};

export default App;

