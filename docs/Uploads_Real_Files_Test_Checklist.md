# Real File / Image Uploads — Test Checklist

**App:** `C:\BuildFlow-Mobile`  
**Server:** must be restarted after upload middleware changes

## 1) Material images (Admin / Procurement)
- [ ] Materials → New/Edit → tap photo area → Gallery or Camera
- [ ] Save → list shows thumbnail from `/uploads/materials/...`
- [ ] Edit again → existing image loads; can replace or remove

## 2) PO invoice upload (Supplier / Admin)
- [ ] Purchase Orders → open PO → **Choose PDF / image** → Upload Invoice
- [ ] Path saved as `/uploads/invoices/...`
- [ ] Image invoices preview on detail; PDF shows path
- [ ] Accountant can pay after invoice exists

## 3) Delivery note upload (Delivery Staff / Admin)
- [ ] Deliveries → detail → Choose PDF / image → Upload Note
- [ ] Saved under `/uploads/delivery-notes/...`
- [ ] Image preview if photo

## 4) Profile avatar (all roles)
- [ ] Profile → tap photo → Gallery/Camera → Save Photo
- [ ] Avatar shows after save; Remove works

## Notes
- Android emulator API base: `http://10.0.2.2:5000`
- Images load via `http://10.0.2.2:5000/uploads/...`
- Full app restart recommended after dependency changes (`image_picker`, `file_picker`)
