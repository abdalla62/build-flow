const Supplier = require('../models/Supplier');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resolve the Supplier directory profile for a logged-in user.
 * Matches by email, then by name (syncing email), otherwise creates a profile
 * for Supplier-role users so Quotes & Bids can work.
 */
async function resolveSupplierProfile(user) {
  if (!user?.email) return null;

  const email = String(user.email).trim().toLowerCase();

  let profile = await Supplier.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
  });
  if (profile) return profile;

  if (user.name) {
    profile = await Supplier.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(user.name.trim())}$`, 'i') }
    });
    if (profile) {
      profile.email = email;
      await profile.save();
      return profile;
    }
  }

  if (user.role === 'Supplier') {
    profile = await Supplier.create({
      name: user.name || 'Supplier',
      company: `${user.name || 'Supplier'} Co.`,
      phone: '0000000000',
      email,
      address: 'Not provided',
      paymentTerms: 'Net 30',
      suppliedCategories: [],
      performanceRating: 5
    });
    return profile;
  }

  return null;
}

/**
 * True when PM invite list is empty (open) or includes this supplier.
 * Also matches if an invited supplier record uses the same login email.
 */
async function isSupplierInvited(request, supplierProfile, user) {
  const invitedIds = (request.suppliers || []).map((id) => id.toString());
  if (invitedIds.length === 0) return true;
  if (invitedIds.includes(supplierProfile._id.toString())) return true;

  if (!user?.email) return false;
  const email = String(user.email).trim().toLowerCase();
  const invitedDocs = await Supplier.find({ _id: { $in: request.suppliers } }).select('email');
  return invitedDocs.some((s) => String(s.email || '').trim().toLowerCase() === email);
}

module.exports = {
  resolveSupplierProfile,
  isSupplierInvited,
  escapeRegex
};
