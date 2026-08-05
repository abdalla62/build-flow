# Phase 8 — Release Candidate / UAT Checklist

**App:** `C:\BuildFlow-Mobile`  
**Goal:** Feature parity with web for release candidate (Inventory + Notifications + polish)

## Before test
1. Server running on port 5000
2. Hot restart Flutter (`R`) — or full restart if providers changed
3. Emulator/device can reach API (`10.0.2.2:5000` for Android emulator)

---

## A) Inventory (Admin)
- [ ] Home → **Inventory**
- [ ] **Stock** tab shows material balances (low stock highlighted)
- [ ] **Alerts** tab shows materials at/below minimum
- [ ] **Ledger** tab shows Stock In/Out history (incl. delivery Stock In)
- [ ] **Adjust** → Stock In or Stock Out → balance + ledger update
- [ ] Same balances visible on web Inventory

## B) Notifications (all roles)
- [ ] Home app bar → bell icon → **Notifications**
- [ ] List loads; tap opens detail and marks read
- [ ] **Mark all read** works
- [ ] Trigger a workflow event (e.g. delivery assigned) → notification appears for target user

## C) Profile polish
- [ ] Profile → **Change Password** (current + new ≥6 chars)
- [ ] Logout still works
- [ ] Session restore after app restart still works

## D) End-to-end UAT (spot check vs web)
Run one thin slice across roles on **mobile**, confirm same records on **web**:

| Step | Role | Action | Pass |
|------|------|--------|------|
| 1 | Admin | Create/check user, material, supplier, project | [ ] |
| 2 | SE | Create material request | [ ] |
| 3 | PM | Approve (with ≥1 supplier) | [ ] |
| 4 | Supplier | Submit quote | [ ] |
| 5 | Procurement | Select quote → PO | [ ] |
| 6 | Supplier | Accept PO + invoice | [ ] |
| 7 | Procurement | Schedule delivery | [ ] |
| 8 | Delivery | Mark Delivered | [ ] |
| 9 | Admin | Inventory Stock In visible | [ ] |
| 10 | Accountant | Record payment (offline OK) | [ ] |
| 11 | Admin | Dashboard / Reports / Audit show activity | [ ] |

## E) Role home smoke
- [ ] Admin sees master data + inventory + payments + insights
- [ ] SE / PM / Procurement / Supplier / Accountant / Delivery each see their modules
- [ ] No blank home for known roles

## Pass criteria (RC)
- [ ] Inventory parity (view + Admin adjust)
- [ ] Notifications usable
- [ ] Change password works
- [ ] Thin E2E slice passes on mobile and matches web

## After PASS
Mobile full-system conversion is **release candidate**. Optional follow-ups: store signing, deeper offline, Excel file export on device, avatar upload.
