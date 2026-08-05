# Phase 2 — Test Checklist (Master Data)

**Scope:** Users, Projects, Categories, Materials, Suppliers  
**App folder:** `C:\BuildFlow-Mobile`

## Before test
1. Server running (`npm run dev` on port 5000)
2. Emulator running
3. Hot restart app after Phase 2 code:
   ```powershell
   cd C:\BuildFlow-Mobile
   flutter run -d emulator-5554
   ```
   Or press `R` in the flutter terminal for hot restart.

## Login as Administrator

### Users
- [ ] Open **Users** from Admin Home
- [ ] List shows existing users
- [ ] Create a Site Engineer user
- [ ] Activate/Deactivate from menu
- [ ] Delete a test user (not yourself)

### Projects
- [ ] Open **Projects**
- [ ] Create project (name, location, budget, manager)
- [ ] Edit project
- [ ] Delete test project

### Categories
- [ ] Open **Categories**
- [ ] Create category (name + description)
- [ ] Edit / delete

### Suppliers
- [ ] Open **Suppliers**
- [ ] Create supplier (includes login password)
- [ ] Edit supplier
- [ ] Delete test supplier

### Materials
- [ ] Open **Materials**
- [ ] Create material (needs category + at least 1 supplier)
- [ ] Edit / delete

## Pass criteria
- [ ] All five modules open without crash
- [ ] Create works and appears in list
- [ ] Data also visible on web (same MongoDB)

## After PASS
Tell the team → start **Phase 3** (Material Requests + Approvals + Receive)
