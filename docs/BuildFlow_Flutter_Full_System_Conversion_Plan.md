# BuildFlow — Full System → Flutter Mobile Plan

**Plan type:** NEW (replaces the earlier limited SE/PM/Delivery-only mobile MVP)  
**Decision:** Convert the **entire web system** into a **Flutter (Dart) mobile application**  
**Rule:** Do **not** change business behavior — same features, same roles, same workflow as the current web app  
**Status:** Planning only (no coding yet)

---

## 1. What this new plan means

| Old plan (cancelled for mobile scope) | New plan |
|---------------------------------------|----------|
| Only SE + PM + Delivery on mobile | **All roles** on mobile |
| Web stays main system | Mobile app becomes the main client |
| Many office features stay web-only | **Full feature parity** with current web |

**“Sida uu yahay” means:**
- Same modules and tasks as today’s website
- Same roles and permissions
- Same statuses and workflow (Request → Approval → Quote → PO → Delivery → Inventory → Payment → Reports)
- Same backend data rules

**What may change (technical only, not business rules):**
- UI layout adapted to phone (cards instead of wide tables where needed)
- Navigation (drawers/tabs instead of desktop sidebar)
- Auth storage (secure token on device)

---

## 2. Target architecture

```text
┌──────────────────────────────────┐
│     Flutter App (Android/iOS)    │
│  All roles · All modules · UI    │
└────────────────┬─────────────────┘
                 │ HTTPS + JWT Bearer
                 ▼
┌──────────────────────────────────┐
│   Existing Express API (server)  │
│   /api/auth, users, projects...  │
└────────────────┬─────────────────┘
                 ▼
┌──────────────────────────────────┐
│           MongoDB                │
└──────────────────────────────────┘
```

- **Keep** current backend (Express + Mongo) as much as possible  
- **Replace** React web client with Flutter client (full coverage)  
- Web may remain temporarily for testing, then optional later

---

## 3. Roles in the mobile app (ALL)

| Role | Must be in Flutter app |
|------|-------------------------|
| Administrator | Yes |
| Site Engineer | Yes |
| Project Manager | Yes |
| Procurement Officer | Yes |
| Supplier | Yes |
| Accountant | Yes |
| Delivery Staff | Yes |

After login, app opens role home (same idea as current web `roleHome`).

---

## 4. Modules to port (1:1 with current web)

These must exist in Flutter with equivalent capability:

1. Authentication (Login, Forgot/Reset password, Profile, Change password)  
2. Dashboard (role-based stats/charts as on web)  
3. Users (Admin)  
4. Projects  
5. Categories  
6. Materials  
7. Suppliers  
8. Material Requests (+ approve/reject, receive/damage)  
9. Supplier Quotes / Quotations  
10. Purchase Orders (+ invoice where applicable)  
11. Deliveries (+ status updates)  
12. Inventory (balances, alerts, ledger, stock adjustment for Admin)  
13. Payments (including WaafiPay / mobile wallet flow as web)  
14. Reports (+ export if feasible on mobile)  
15. Audit Logs (Admin)  
16. Notifications  

**Nothing from the current web feature set should be dropped** in the final mobile product.

---

## 5. Navigation concept (full app)

Because all modules are included, use a **role-filtered menu** (like web sidebar):

- Drawer or bottom-nav + “More” menu  
- Each role sees only allowed menus (same permissions as web)  
- Example Admin: Dashboard, Users, Projects, Materials, … Reports, Audit  
- Example Site Engineer: Dashboard/Home, Requests, Deliveries, Profile  

---

## 6. Screen inventory (high level)

### Shared
- Splash, Login, Forgot Password, Reset Password  
- Profile, Change Password, Notifications  
- Unauthorized / empty / error states  

### Admin-heavy
- Users CRUD  
- Categories CRUD  
- Materials CRUD  
- Suppliers CRUD  
- Projects CRUD  
- Inventory view + Stock Adjustment  
- Audit logs list  
- Full dashboard + reports  

### Operational
- Material Requests list/create/detail/approve/receive  
- Quotations list/submit/compare actions  
- Purchase Orders list/create/edit/status/invoice  
- Deliveries list/create/status update  
- Payments list/create + payment summary  
- Role dashboards  

Exact screen count will be large (likely **60–100+ screens/states**).  
This is expected for a full ERP-style port.

---

## 7. API strategy

- Reuse existing endpoints under `/api/...`  
- Standardize mobile auth on **Bearer JWT** (`Authorization` header)  
- Confirm every web feature has an API (if any UI-only logic exists, move to API)  
- Before coding UI deeply: produce **API coverage checklist** module-by-module  

---

## 8. Flutter project structure (planned)

```text
lib/
  core/                 # theme, router, network, errors, storage
  shared/               # widgets, formatters, status pills
  features/
    auth/
    dashboard/
    users/
    projects/
    categories/
    materials/
    suppliers/
    requests/
    quotations/
    purchase_orders/
    deliveries/
    inventory/
    payments/
    reports/
    audit_logs/
    notifications/
    profile/
  models/
  services/             # API services per module
```

State management (decide before coding): **Riverpod** or **Bloc** (team choice).  
Recommendation: **Riverpod** for speed + clarity.

---

## 9. Phased delivery (full system, but still stepwise)

Even for full conversion, build in phases so work stays controllable.  
Each phase must keep **behavior equal to web** for finished modules.

| Phase | Scope | Done when |
|-------|--------|-----------|
| **P0** | Plan + API auth decision + design system in Flutter | Team aligned |
| **P1** | Auth + Profile + role routing + notifications shell | All roles can log in |
| **P2** | Admin master data: Users, Projects, Categories, Materials, Suppliers | Setup equals web |
| **P3** | Requests + PM approvals + SE receive/damage | Core request cycle |
| **P4** | Quotations + Purchase Orders | Procurement cycle |
| **P5** | Deliveries + Inventory effects | Logistics cycle |
| **P6** | Payments (WaafiPay) | Finance cycle |
| **P7** | Dashboards + Reports + Audit Logs | Parity complete |
| **P8** | Polish, offline-light, store build, UAT vs web checklist | Release candidate |

**Definition of “finished product”:**  
Every current web capability is available in the Flutter app for the correct roles.

---

## 10. UX rule for full-system mobile

To keep it usable on phones while not removing features:

- Keep **all actions** available  
- Replace wide tables with **card lists + detail pages + filters**  
- Multi-step forms for long create/edit flows  
- Same field validation and required data as web  
- Same status names and role permissions  

This changes **presentation**, not **business rules**.

---

## 11. Risks (must accept in this plan)

1. **Large scope** — full ERP on mobile is a big project  
2. **Complex forms** (PO, reports, payments) need careful mobile UX  
3. **Charts/reports** need Flutter chart/export approach  
4. **File uploads** (invoice/avatar) need mobile file pickers  
5. **Time** — longer than field-only MVP  

Mitigation: phase P1–P8, test each module against web behavior checklist.

---

## 12. Team decisions to confirm

1. Confirm: **Full system Flutter conversion** (yes)  
2. Backend: keep current API (recommended yes)  
3. State management: Riverpod or Bloc?  
4. First OS: Android only, then iOS?  
5. After Flutter parity: retire web UI, or keep both?

---

## 13. Immediate next steps (still no feature coding)

1. Freeze this plan as the official scope  
2. Make module checklist from current web sidebar/routes  
3. Auth approach: Bearer token for Flutter  
4. Then start **P1 Auth only**

---

## Current implementation status

| Phase | Status |
|-------|--------|
| P1 Auth + role home + profile | **DONE — tested PASS** |
| P2 Master data (Users/Projects/Categories/Materials/Suppliers) | **DONE — ready for team test** |
| P3 Requests + PM review + SE receive | **DONE — ready for team test** |
| P4 Quotations + Purchase Orders | **DONE — ready for team test** |
| P5–P8 | Not started |

See: `docs/Phase1_Auth_Test_Checklist.md`

