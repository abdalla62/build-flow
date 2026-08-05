# Phase 6 — Test Checklist (Payments / Waafi)

**App:** `C:\BuildFlow-Mobile`

## Flow (same as web)
Delivered PO + supplier invoice → Accountant/Admin records payment (Waafi Mobile Wallet or offline) → PO paymentStatus updates

## Before test
1. Server running (`npm run dev` in `server/`)
2. Hot restart Flutter (`R`)
3. Have a PO that is:
   - Status **Delivered** (Phase 5 delivery marked Delivered)
   - Supplier **invoice** uploaded on the PO
   - Payment status not Paid / Cancelled
4. For Waafi: `WAAFI_MERCHANT_UID`, `WAAFI_API_USER_ID`, `WAAFI_API_KEY` in `server/.env`  
   (If not configured, use **Bank Transfer / Cash** instead)

## A) Accountant / Admin — Ledger
- [ ] Login as Accountant (or Admin)
- [ ] Home → **Payments**
- [ ] Summary tiles load (open invoices / outstanding / paid this month / overdue)
- [ ] Ledger list shows past payments (or empty state)

## B) Record offline payment
- [ ] Tap **Record**
- [ ] Select payable PO (only Delivered + invoiced appear)
- [ ] Method: Bank Transfer (or Cash)
- [ ] Enter amount ≤ remaining, unique reference
- [ ] Submit → appears in ledger; PO paymentStatus → Partially Paid or Paid

## C) Record Waafi Mobile Wallet (optional)
- [ ] Record → method **Mobile Wallet**
- [ ] Enter account `2526XXXXXXXX`
- [ ] Charge via WaafiPay → approve PIN on phone if prompted
- [ ] Ledger shows `WAAFI-…` reference / Waafi TXN id

## D) Supplier view (optional)
- [ ] Supplier can still use Purchase Orders; payments API is filtered to their POs if they open Payments (Admin menu only on home)

## Pass
- [ ] Payable PO list respects invoice + Delivered rules
- [ ] Offline payment records
- [ ] Partial / full pay updates PO paymentStatus
- [ ] Same records visible on web Payments page
- [ ] (If configured) Waafi charge works or shows clear config error

## After PASS → Phase 7 (Dashboard / Reports / Audit)
