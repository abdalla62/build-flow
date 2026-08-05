# Phase 5 — Test Checklist (Deliveries)

**App:** `C:\BuildFlow-Mobile`

## Flow (same as web)
Accepted PO → Procurement schedules delivery → Delivery Staff advances status → **Delivered** auto Stock In

## Before test
1. Server running (`npm run dev` in `server/`)
2. Hot restart Flutter (`R` in the app terminal)
3. Have: Accepted PO from Phase 4
4. Have: at least one **Delivery Staff** user (Admin → Users)

## A) Procurement / Admin — Schedule
- [ ] Login as Procurement Officer or Admin
- [ ] Home → **Deliveries** → **Schedule**
- [ ] Select Accepted (or Pending) PO, Delivery Staff driver, vehicle, address, date, time slot
- [ ] Schedule → appears in list with status **Scheduled**
- [ ] PO status becomes **Preparing** (check Purchase Orders)

## B) Delivery Staff — Status updates
- [ ] Login as the assigned Delivery Staff
- [ ] Home → **Deliveries** (only own assignments)
- [ ] Open delivery → **Mark as Preparing** → then Dispatched → In Transit → Delivered
- [ ] Optional: save delivery note reference string
- [ ] Optional: **Mark Delayed** (before Delivered)

## C) Site Engineer — Incoming view
- [ ] Login as Site Engineer who owns the original request
- [ ] Home → **Deliveries** → see related incoming deliveries (read-only)

## D) Inventory effect
- [ ] After status **Delivered**, check web Inventory / material stock increased (Stock In)
- [ ] Same delivery visible on web Deliveries page

## Pass
- [ ] Schedule works (Proc/Admin)
- [ ] Driver can advance status to Delivered
- [ ] SE can view related deliveries
- [ ] Delivered triggers Stock In
- [ ] Same records on web

## After PASS → Phase 6 (Payments / Waafi)
