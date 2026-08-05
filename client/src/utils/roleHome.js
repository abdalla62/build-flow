/** Default landing page after login for each role */
export function getRoleHomePath(role) {
  switch (role) {
    case 'Administrator':
      return '/';
    case 'Site Engineer':
      return '/material-requests';
    case 'Project Manager':
      return '/material-requests';
    case 'Procurement Officer':
      return '/purchase-orders';
    case 'Supplier':
      return '/purchase-orders';
    case 'Accountant':
      return '/payments';
    case 'Delivery Staff':
      return '/deliveries';
    default:
      return '/';
  }
}
