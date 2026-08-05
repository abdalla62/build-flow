const multer = require('multer');
const path = require('path');
const fs = require('fs');

/** Feature 10.10 — supported document types */
const DOC_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.docx'];
const DOC_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Some browsers send DOCX as zip/octet-stream — still allow by extension below
  'application/octet-stream',
  'application/zip'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
      const safeExt = DOC_EXTS.includes(ext) ? ext : '.bin';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    }
  });
}

function imageFilter(req, file, cb) {
  if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, png, webp, gif)'));
  }
}

/** PDF, JPG, PNG, DOCX (+ common image variants) — Feature 10.10 */
function documentFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimeOk = DOC_MIMES.includes(String(file.mimetype || '').toLowerCase());
  const extOk = DOC_EXTS.includes(ext);

  if (extOk && (mimeOk || ext === '.docx' || ext === '.pdf' || /^image\//i.test(file.mimetype))) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG, PNG, or DOCX files are allowed'));
  }
}

const uploadMaterialImage = multer({
  storage: makeStorage('materials'),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('image');

const uploadAvatar = multer({
  storage: makeStorage('avatars'),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('avatar');

const uploadInvoiceFile = multer({
  storage: makeStorage('invoices'),
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('invoice');

const uploadDeliveryNoteFile = multer({
  storage: makeStorage('delivery-notes'),
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('deliveryNote');

const uploadPaymentReceiptFile = multer({
  storage: makeStorage('receipts'),
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('receipt');

/** Express wrapper so multer errors return JSON */
function wrapUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed'
        });
      }
      next();
    });
  };
}

module.exports = {
  uploadMaterialImage: wrapUpload(uploadMaterialImage),
  uploadAvatar: wrapUpload(uploadAvatar),
  uploadInvoiceFile: wrapUpload(uploadInvoiceFile),
  uploadDeliveryNoteFile: wrapUpload(uploadDeliveryNoteFile),
  uploadPaymentReceiptFile: wrapUpload(uploadPaymentReceiptFile)
};
