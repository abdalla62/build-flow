# BuildFlow Mobile Application  
## Supervisor Brief: Purpose, Users, and Workflow

**System title (updated):**  
*Optimizing Construction Procurement: A Distributed Web and Mobile System for Field Logistics and Financial Tracking*

**Product name:** BuildFlow  
**Document purpose:** Explain how the planned mobile application works, who uses it, and how it fits into the overall procurement workflow.  
**Audience:** Project supervisor / academic reviewer  
**Related platform:** Existing BuildFlow web system (administration, procurement operations, payments, and reporting)

---

## 1. Purpose of the Mobile App

The BuildFlow mobile application supports **field logistics** for construction material procurement. It is designed for staff working on project sites and during delivery, where a full desktop dashboard is impractical.

The mobile app does **not** replace the web system. Instead, the platform becomes **distributed**:

| Platform | Role |
|----------|------|
| **Web system** | Control center: user management, materials catalog, quotations, purchase orders, payments, inventory controls, reports |
| **Mobile app** | Field tool: create/track requests, update delivery status, confirm receipt, light approvals |

This matches the research/project focus on **field logistics** and **financial tracking**, while keeping complex financial processing and master data management on the web.

---

## 2. Who Uses the Mobile App

### 2.1 Primary users (MVP – first release)

| User role | Main responsibility on mobile | Why mobile? |
|-----------|-------------------------------|-------------|
| **Site Engineer** | Request materials, track request status, confirm delivery / report damage | Works on site; needs fast task entry |
| **Delivery Staff** | View assigned shipments and update delivery status | Works in transit / on the road |

### 2.2 Secondary users (later phases)

| User role | Mobile use | Notes |
|-----------|------------|-------|
| **Project Manager** | Approve or reject material requests | Useful when away from desk |
| **Accountant** | View payment summary only (unpaid, outstanding, overdue) | No payment processing on mobile |

### 2.3 Users who stay on the web (not mobile-first)

| User role | Main work on web |
|-----------|------------------|
| **Administrator** | Users, roles, system configuration, inventory adjustments, audit logs, reports |
| **Procurement Officer** | Quotations, purchase orders, supplier coordination |
| **Supplier** | Quotes and order-related tasks (web) |

**Account creation:** There is no public self-registration. Accounts are created by the **Administrator**. After login, each role is redirected to the correct area automatically.

---

## 3. How the Mobile App Works (High Level)

1. User logs in with email and password (same authentication as the web system).  
2. The app detects the user role and shows only the screens needed for that role.  
3. Actions performed on mobile are saved through the **same backend API** used by the web system.  
4. Other roles immediately see updated status (for example: request approved, delivery completed).  
5. When goods are marked **Delivered**, stock and related financial/payment visibility can update in the central system (web dashboards and reports).

**Design principle:** One job per screen, large buttons, clear status labels (Pending, Approved, In Transit, Delivered, etc.). The mobile UI avoids dense tables and full admin dashboards.

---

## 4. End-to-End Workflow

The complete procurement flow combines **web + mobile**. Mobile covers the field steps marked below.

```text
[Site Engineer – Mobile]
        |  Creates Material Request
        v
[Project Manager – Mobile or Web]
        |  Approves / Rejects request
        v
[Procurement Officer – Web]
        |  Collects supplier quotes
        |  Creates Purchase Order
        v
[Delivery Staff – Mobile]
        |  Updates status:
        |  Preparing → Dispatched → In Transit → Delivered
        v
[Site Engineer – Mobile]
        |  Confirms receipt
        |  OR reports damaged quantity
        v
[System – Backend]
        |  Updates delivery/PO status
        |  Updates inventory (stock in / damage stock out)
        v
[Accountant / Admin – Web]
           Payments, outstanding balances, reports, financial tracking
```

### 4.1 Step-by-step explanation

1. **Request (Field)**  
   Site Engineer opens the mobile app and submits a material request (project, material, quantity, priority, reason).

2. **Approval**  
   Project Manager reviews the request and approves or rejects it (mobile or web).

3. **Procurement (Office – Web)**  
   Procurement Officer manages quotations and creates the purchase order. This remains on web because it needs richer forms and supplier comparison.

4. **Logistics (Field – Mobile)**  
   Delivery Staff updates shipment status in real time so the site team can track progress.

5. **Receipt (Field – Mobile)**  
   Site Engineer confirms that materials arrived, or reports damage. Damaged quantities reduce stock accordingly.

6. **Financial tracking (Office – Web)**  
   Accountant processes/records payments and monitors unpaid/outstanding/overdue amounts. Admin and managers view reports on the web. Mobile may later show a small summary only.

---

## 5. Mobile Screens by Role (MVP Scope)

### 5.1 Site Engineer

| Screen | Function |
|--------|----------|
| Login | Secure access |
| Home | Quick actions: New Request, My Requests, Incoming Deliveries |
| New Request | Create material request |
| My Requests | List and status tracking |
| Request Detail | Full details and timeline |
| Confirm Receipt | Accept goods or report damage |
| Profile | Account info and logout |

### 5.2 Delivery Staff

| Screen | Function |
|--------|----------|
| Login | Secure access |
| My Shipments | Assigned deliveries |
| Shipment Detail | Address, materials, schedule |
| Update Status | Preparing → Dispatched → In Transit → Delivered (plus Delayed if needed) |
| Profile | Account info and logout |

### 5.3 Project Manager (phase 2)

| Screen | Function |
|--------|----------|
| Approvals inbox | Pending requests |
| Request review | Approve / Reject with comment |

---

## 6. Web vs Mobile Responsibility Matrix

| Capability | Web | Mobile |
|------------|-----|--------|
| User & role management | Yes | No |
| Materials / categories / suppliers CRUD | Yes | No |
| Create material request | Yes | Yes (Site Engineer) |
| Approve / reject request | Yes | Yes (Project Manager) |
| Quotations & PO creation | Yes | No |
| Delivery status updates | Yes | Yes (Delivery Staff) |
| Confirm receipt / damage | Yes | Yes (Site Engineer) |
| Payments (e.g. mobile wallet) | Yes | No |
| Inventory adjustment | Yes (Admin) | No |
| Reports / exports | Yes | No |
| Field notifications / status tracking | Supporting | Primary |

---

## 7. Benefits for the Project

- **Field efficiency:** Site and delivery staff can work without returning to an office computer.  
- **Real-time logistics:** Delivery status is visible to the project team as it changes.  
- **Clear separation of concerns:** Office operations stay on web; field tasks stay on mobile.  
- **Aligned with the title:** Supports a *distributed web and mobile* approach for *field logistics* and *financial tracking*.  
- **Builds on the existing system:** Reuses the current BuildFlow backend, roles, and procurement process instead of redesigning everything.

---

## 8. Implementation Phases (Recommended)

| Phase | Scope |
|-------|--------|
| **Phase 1 (MVP)** | Site Engineer + Delivery Staff mobile apps; shared login API |
| **Phase 2** | Project Manager approvals on mobile; push notifications |
| **Phase 3** | Accountant read-only financial snapshot; optional offline support |

---

## 9. Summary for Supervisor

BuildFlow Mobile is a **role-based field application** for construction procurement logistics.  
**Site Engineers** request and receive materials; **Delivery Staff** update shipment progress; **Project Managers** may approve requests; **financial processing and administration remain on the web**.  

Together, the web and mobile systems form a **distributed procurement platform** that connects site operations with office procurement and financial tracking.

---

*Document prepared for supervisor review — BuildFlow / Construction Material Procurement System.*
