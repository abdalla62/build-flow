# BuildFlow Mobile — Flutter Pre-Implementation Plan

**Status:** Planning only (no coding yet)  
**Decision:** Mobile app with **Flutter (Dart)**  
**Backend:** Existing BuildFlow **web API** (Express + MongoDB) — same database, same users/roles  
**Goal:** App behaves like the web product (same login, same data, same business rules), focused on field roles first.

---

## 1. What we agreed

| Topic | Decision |
|-------|----------|
| Technology | Flutter + Dart |
| Backend | Reuse current `/api/*` (do not rebuild server) |
| Product | Same BuildFlow system as web |
| First release (MVP) | Site Engineer + Project Manager + Delivery Staff |
| Later | More roles / features if needed |
| Design | Match BuildFlow brand (teal, clean cards, status pills) using Stitch UI as reference |

**Important meaning of “like the web app”:**  
Same accounts, same workflow, same statuses, same API.  
It does **not** mean every web admin page must exist in Flutter on day one.

---

## 2. Architecture (how it will work)

```text
┌─────────────────────┐
│  Flutter Mobile App │  (Android / iOS)
│  UI + local state   │
└──────────┬──────────┘
           │ HTTPS JSON
           ▼
┌─────────────────────┐
│  Express API (Web)  │  /api/auth, /api/requests, ...
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  MongoDB            │  same data as website
└─────────────────────┘
```

- User logs in on mobile → gets JWT (same as web).  
- Every action updates the **same** database.  
- Web users see mobile updates immediately (and vice versa).

---

## 3. Who uses the Flutter app (MVP)

| Role | Uses Flutter? | Main jobs |
|------|---------------|-----------|
| Site Engineer | Yes | Create request, track, confirm receipt/damage |
| Project Manager | Yes | Approve / reject requests |
| Delivery Staff | Yes | View shipments, update status |
| Administrator | No (web) | Users, setup, reports, inventory adjust |
| Procurement Officer | No (web) | Quotes, create PO, plan delivery |
| Supplier | No (web) | Submit quotes, invoice |
| Accountant | No (web) | Payments |

---

## 4. Flutter app modules (folders / features)

Suggested app structure (conceptual):

```text
lib/
  core/           # theme, API client, constants, routers
  features/
    auth/         # login, forgot password, session
    se/           # Site Engineer screens
    pm/           # Project Manager screens
    delivery/     # Delivery Staff screens
    shared/       # profile, notifications, widgets
  models/         # Request, Delivery, User, ...
  services/       # auth_api, request_api, delivery_api
```

After login, app reads `user.role` and opens the correct home (same idea as web `roleHome`).

---

## 5. Screens to build (MVP checklist)

### Auth
- [ ] Splash / startup session check
- [ ] Login (email + password)
- [ ] Forgot password
- [ ] Auto-logout on 401

### Site Engineer
- [ ] Home (Pending / Approved / Delivered counts)
- [ ] New Material Request
- [ ] My Requests list
- [ ] Request detail
- [ ] Incoming deliveries list
- [ ] Confirm receipt (All good / Report damage)
- [ ] Profile + logout

### Project Manager
- [ ] Home (pending approvals count)
- [ ] Approvals inbox
- [ ] Request review (comment + Approve / Reject)
- [ ] Profile + logout

### Delivery Staff
- [ ] My shipments list
- [ ] Shipment detail
- [ ] Update status stepper (Preparing → … → Delivered)
- [ ] Mark delayed (+ reason)
- [ ] Profile + logout

### Shared (optional in MVP)
- [ ] Notifications list

---

## 6. API mapping (existing web endpoints)

| Mobile action | Likely API |
|---------------|------------|
| Login | `POST /api/auth/login` |
| Current user | `GET /api/auth/me` |
| Logout | `GET /api/auth/logout` |
| Forgot password | `POST /api/auth/forgot-password` |
| List / create requests | `GET/POST /api/requests` |
| Approve / reject | request approval endpoints (existing PM flow) |
| Confirm receipt / damage | `PUT /api/requests/:id/receive` |
| List deliveries | `GET /api/deliveries` |
| Update delivery status | `PUT /api/deliveries/:id/status` |
| Projects / materials (dropdowns) | `GET /api/projects`, `GET /api/materials` |
| Notifications | `GET /api/notifications` |

**Before coding:** write a one-page “API contract” confirming exact paths + JSON fields for approve/reject and create request.

---

## 7. Auth plan (must decide before code)

Web currently uses cookie + JWT JSON. Mobile needs a clear rule:

**Recommended for Flutter:**
1. Login → save `token` securely (`flutter_secure_storage`)
2. Send `Authorization: Bearer <token>` on every request
3. Ignore cookie-only auth for mobile

**Backend small change later (when coding starts):**  
Ensure CORS allows the app origin/hosting and Bearer token auth works everywhere (already partly supported).

---

## 8. UI / UX plan

- Follow Stitch screens (SE / PM / DS) as design reference
- Brand: teal primary `#0F766E`, light backgrounds, status pills
- Cards + large buttons (no dense tables)
- Same status words as web:
  - Request: Pending, Approved, Rejected, Delivered
  - Delivery: Preparing, Dispatched, In Transit, Delivered, Delayed
  - Payment stays on web (not in Flutter MVP)

---

## 9. Implementation phases (still no code until approved)

| Phase | Work | Outcome |
|-------|------|---------|
| **0 – Plan (now)** | Agree scope, screens, API, auth | This document |
| **1 – Foundation** | Flutter project, theme, API client, login | User can sign in |
| **2 – Site Engineer** | Request + receipt flows | SE demo ready |
| **3 – Project Manager** | Approvals | PM demo ready |
| **4 – Delivery Staff** | Status updates | Full field loop demo |
| **5 – Polish** | Errors, loading, empty states, notifications | Supervisor-ready app |

---

## 10. Tools & packages (planned, not installed yet)

| Need | Package (planned) |
|------|-------------------|
| HTTP | `dio` or `http` |
| Secure token | `flutter_secure_storage` |
| State | `provider` or `riverpod` |
| Navigation | `go_router` |
| Forms | Flutter forms + validators |
| Storage prefs | `shared_preferences` (theme only) |

---

## 11. Environments

| Env | API base URL example |
|-----|----------------------|
| Local | `http://YOUR-PC-IP:5000` (not localhost on physical phone) |
| Online later | `https://your-api-domain.com` |

Need: server reachable from phone (same Wi-Fi or deployed API).

---

## 12. Out of scope for Flutter MVP

- Admin user management
- Create categories / materials / suppliers
- Quotations comparison UI
- Create / edit Purchase Orders
- Payments / WaafiPay
- Inventory stock adjustment
- Full reports / Excel export

These remain on **web**.

---

## 13. Success criteria (when MVP is “done”)

1. SE creates request on phone  
2. PM approves on phone  
3. (Web) Procurement creates PO + delivery as today  
4. Delivery Staff marks Delivered on phone  
5. SE confirms receipt on phone  
6. Same records visible on web dashboard  

---

## 14. Decisions to confirm before coding

Please confirm as a team:

1. MVP roles = **SE + PM + Delivery only**? (Yes/No)  
2. Auth = **Bearer token in secure storage**? (Recommended Yes)  
3. Design source = **Stitch screens**? (Yes/No)  
4. First target OS = **Android only** or Android + iOS together?  
5. Backend for demo = **local network** first or wait for online deploy?

---

## 15. Next step (after confirmation)

Only then:
1. Create Flutter project  
2. Wire login to existing API  
3. Build SE flow first  

Until the five decisions above are confirmed, stay in planning mode.
