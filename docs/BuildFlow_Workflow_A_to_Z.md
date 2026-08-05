# BuildFlow — System Workflow A to Z (Login → Payment)

**For supervisor / WhatsApp group**  
**System:** Construction Material Procurement (BuildFlow)

---

## One-line summary

Site Engineer requests materials → Project Manager approves → Procurement gets quotes & creates PO → Delivery Staff delivers → Site confirms receipt → Accountant pays → Admin checks reports.

---

## Who does what

| Role | Tasks |
|------|--------|
| Administrator | Create users & master data; dashboard/reports |
| Site Engineer | Create material request; confirm receipt / damage |
| Project Manager | Approve or reject request |
| Procurement Officer | Quotations + Purchase Order + schedule delivery |
| Supplier | Submit quote; invoice |
| Delivery Staff | Update delivery status until Delivered |
| Accountant | Post payment; track Unpaid / Paid / Overdue |

---

## Step-by-step (A → Payment)

| Step | Task | Who | Menu / Screen | Result |
|------|------|-----|---------------|--------|
| **A** | Login | Any user | Login | Role home opens |
| **B** | Setup master data | Administrator | Users, Projects, Categories, Suppliers, Materials | System ready |
| **C** | Create Material Request | Site Engineer | Material Requests | Status = **Pending** |
| **D** | Approve / Reject | Project Manager | Material Requests | **Approved** or **Rejected** |
| **E** | Supplier Quotes | Procurement + Supplier | Supplier Quotes | Prices compared |
| **F** | Create Purchase Order | Procurement Officer | Purchase Orders | PO created |
| **G** | Schedule Delivery | Procurement / Admin | Deliveries | Driver assigned |
| **H** | Update delivery status | Delivery Staff | Deliveries | Preparing → Dispatched → In Transit → **Delivered** (+ stock in) |
| **I** | Confirm receipt / damage | Site Engineer | Material Requests (Receive) | Receipt recorded; damage → stock out |
| **J** | Invoice on PO | Supplier / Procurement | Purchase Orders | Ready for payment rules |
| **K** | Payment | Accountant | Payments | **Unpaid → Partially Paid → Paid** |
| **L** | Verify & report | Admin / Accountant | Dashboard, Reports | Full cycle proof |

---

## Status chains

**Request:** Pending → Approved / Rejected → Delivered  

**Delivery:** Preparing → Dispatched → In Transit → Delivered  

**Payment:** Unpaid → Partially Paid → Paid (or Overdue)

---

## Pipeline (copy-paste)

```text
Login
 → Admin setup (Users/Projects/Materials…)
 → Material Request (Site Engineer)
 → Approval (Project Manager)
 → Quotation (Supplier / Procurement)
 → Purchase Order (Procurement)
 → Delivery schedule
 → Delivery tracking (Delivery Staff)
 → Receipt / Damage (Site Engineer)
 → Invoice
 → Payment (Accountant)
 → Dashboard / Reports
```

---

## What to send in WhatsApp

1. Screenshot of this workflow (or the Canvas view)  
2. Short screen recording clicking menus in order **C → K**  
3. Final screenshot: **Payments** page showing Paid / transaction  

---

*BuildFlow — Optimizing Construction Procurement (Web + planned Mobile)*
