# Phase 1 — Test Checklist (Auth)

**Scope done:** Flutter app skeleton + Login + session + role home + profile + logout  
**Do not start Phase 2 until this checklist passes.**

## Before testing

1. Start backend:
   ```bash
   cd server
   npm run dev
   ```
2. MongoDB must be running with existing users.
3. Run Flutter app:
   - **Android emulator:**
     ```bash
     cd mobile
     flutter run
     ```
     (default API: `http://10.0.2.2:5000`)
   - **Windows desktop (easy for team test):**
     ```bash
     cd mobile
     flutter run -d windows --dart-define=API_BASE_URL=http://127.0.0.1:5000
     ```
   - **Physical phone (same Wi-Fi):**
     ```bash
     flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:5000
     ```

## Test cases

| # | Test | Expected |
|---|------|----------|
| 1 | Open app | Splash then Login |
| 2 | Empty email/password submit | Validation errors |
| 3 | Wrong password | Error snackbar |
| 4 | Valid Admin login | Lands on **Admin Home** |
| 5 | Valid Site Engineer login | Lands on **Site Engineer Home** |
| 6 | Valid PM login | Lands on **Project Manager Home** |
| 7 | Valid Delivery login | Lands on **Delivery Home** |
| 8 | Open Profile | Shows name, email, role |
| 9 | Logout | Returns to Login |
| 10 | Kill app & reopen after login | Session restored (still logged in) |
| 11 | Forgot Password screen opens | Email form works / server responds |

## Pass / Fail

- [ ] All critical tests 1–10 passed  
- [ ] Team sign-off to start **Phase 2 (Master data)**

## Notes

- No Sign Up on purpose (Admin creates accounts on web for now; Users module comes in Phase 2).  
- Role home screens are placeholders until later phases add modules.
