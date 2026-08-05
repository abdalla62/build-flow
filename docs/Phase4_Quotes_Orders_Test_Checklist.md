# Phase 4 — Test Checklist (Quotations + Purchase Orders)

**App:** `C:\BuildFlow-Mobile`

## Flow (same as web)
Approved request → Supplier submits bid → Procurement selects bid → PO created → Supplier accepts PO

## Before test
1. Server running
2. Hot restart Flutter (`R`)
3. Have: Approved request with invited supplier(s) from Phase 3

## A) Supplier — Submit bid
- [ ] Login as Supplier (invited on the approved request)
- [ ] Home → **Quotations** → **Submit Bid**
- [ ] Choose approved request, enter unit price, delivery cost, days, terms
- [ ] Submit → appears in quotations list

## B) Procurement / Admin — Select bid
- [ ] Login as Procurement Officer or Admin
- [ ] Home → **Quotations**
- [ ] Find Pending bid → **Select & Create PO**
- [ ] Confirm → snackbar shows PO number
- [ ] Other bids become Rejected; request becomes Ordered

## C) Purchase Orders
- [ ] Home → **Purchase Orders**
- [ ] Open new PO detail (total, items, payment Unpaid)
- [ ] Supplier login → open PO → **Accept PO** (or Reject)
- [ ] Supplier → save invoice reference string

## Pass
- [ ] Bid submit works
- [ ] Select quote creates PO
- [ ] PO list/detail works
- [ ] Supplier can accept PO
- [ ] Same records on web

## After PASS → Phase 5 (Deliveries + Inventory effects)
