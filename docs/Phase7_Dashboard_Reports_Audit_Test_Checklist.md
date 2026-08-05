# Phase 7 — Test Checklist (Dashboard / Reports / Audit)

**App:** `C:\BuildFlow-Mobile`

## Before test
1. Server running
2. Hot restart Flutter (`R`)
3. Prefer accounts with some existing data from Phases 1–6

## A) Dashboard (all roles)
- [ ] Login as **Admin** → Home → **Dashboard**  
  Stats tiles + spend trends + category bars + recent activity
- [ ] **Site Engineer** → Dashboard shows my request counts
- [ ] **Project Manager** → pending/approved/rejected + budget
- [ ] **Procurement** → approved requests, quotes, draft POs, scheduled deliveries
- [ ] **Accountant / Supplier** → payment summary tiles
- [ ] **Delivery Staff** → active / completed / delayed counts from their deliveries
- [ ] Pull-to-refresh works

## B) Reports (Admin + Procurement)
- [ ] Home → **Reports**
- [ ] Tabs: Quotes / Requests / Orders / Deliveries / Payments
- [ ] Totals + status chips + row list load
- [ ] Copy CSV (clipboard) for active tab

## C) Audit Logs (Admin only)
- [ ] Home → **Audit Logs**
- [ ] List shows actions, role chips, user, timestamp
- [ ] Search by name/email/details
- [ ] Prev/Next pagination

## Pass
- [ ] Role dashboards match web data sources
- [ ] Reports load for Admin/Procurement
- [ ] Audit loads for Admin only
- [ ] Unauthorized roles cannot open Reports/Audit via API (403 if forced)

## After PASS → Phase 8 (Polish / Inventory if missing / UAT)
