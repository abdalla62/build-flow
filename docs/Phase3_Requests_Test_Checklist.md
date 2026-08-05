# Phase 3 — Test Checklist (Material Requests)

**Scope:** Create request (SE) · Approve/Reject (PM) · Confirm receipt (SE)  
**App:** `C:\BuildFlow-Mobile`

## Before test
1. Server on port 5000
2. Hot restart Flutter (`R`) or:
   ```powershell
   cd C:\BuildFlow-Mobile
   flutter run -d emulator-5554
   ```
3. Ensure Phase 2 data exists: Project + Material + Supplier  
4. Project manager field must be a real **Project Manager** user

## A) Site Engineer
- [ ] Login as Site Engineer
- [ ] Home → **New Request**
- [ ] Select project, material, qty, priority, date, reason → Submit
- [ ] Appears in **Material Requests** with status **Pending**
- [ ] Open detail — status Pending

## B) Project Manager
- [ ] Logout → Login as Project Manager (must manage that project)
- [ ] Home → **Pending Approvals**
- [ ] Open request → **Review / Approve / Reject**
- [ ] Enter comments
- [ ] Select **at least one supplier** (required for Approve)
- [ ] Tap **Approve**
- [ ] Status becomes **Approved**

Also test once:
- [ ] **Reject** with comments
- [ ] **Return** with comments

## C) Confirm Receipt (SE)
Note: Receipt is available when status is **Approved** or **Ordered**.  
(Full delivery flow is Phase 5; for Phase 3 you can confirm after Approve if your process allows, or wait until Ordered.)

- [ ] Login SE → open Approved request
- [ ] If **Confirm Receipt** button shows:
  - All Good → confirm
  - OR Report Damage → qty + comments → confirm
- [ ] Status becomes **Delivered**

## Pass
- [ ] SE can create request
- [ ] PM can approve with supplier selection
- [ ] Request statuses update correctly
- [ ] Same data visible on web

## After PASS → Phase 4 (Quotations + Purchase Orders)
