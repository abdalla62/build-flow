# BUILD FLOW — Construction Material Mobile App

Flutter mobile client for the existing **BUILD FLOW** Construction Material Procurement Management System.

This app uses the existing Express backend in `../server` and MongoDB. It does **not** include its own API or database.

## Project layout

```text
System ProjectConstruction Materia/
  client/                              # Web (do not modify for this app)
  server/                              # Backend API (do not modify for this app)
  construction_material_mobile_app/    # This Flutter app
```

## Requirements

- Flutter SDK 3.10+
- Running backend: `cd ../server && npm run dev` (port **5000**)
- MongoDB as configured in `server/.env`

## Install & run

```bash
cd construction_material_mobile_app
flutter pub get
flutter run
```

### API base URL

Default (Android emulator → host machine):

```text
http://10.0.2.2:5000
```

Physical phone / tablet (replace with your PC LAN IP):

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5000
```

Windows desktop / Chrome:

```bash
flutter run -d windows --dart-define=API_BASE_URL=http://127.0.0.1:5000
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:5000
```

## Authentication

- Same backend auth as web: JWT via `Authorization: Bearer` and cookie jar
- Login: `POST /api/auth/login`
- Session restore: `GET /api/auth/me` on app launch
- Public registration is disabled (Admin creates accounts)

## Features (parity with web)

Login, Forgot Password, Logout, Session restore, Dashboard, Profile (avatar + change password), Notifications, Users, Projects, Categories, Suppliers, Materials, Material Requests, Quotations, Purchase Orders, Payments, Deliveries, Inventory, Reports, Audit Logs, Light/Dark mode, role-based drawer navigation.

## Roles

Administrator, Procurement Officer, Project Manager, Site Engineer, Supplier, Accountant, Delivery Staff — menus match web `Sidebar.jsx`.

## Tech stack

- Flutter (Android / iOS)
- Dio + PersistCookieJar + secure token storage
- Riverpod
- go_router
- Google Fonts (Inter)
- image_picker / file_picker for uploads

## Brand colors

| Token | Hex |
|-------|-----|
| Primary Teal | `#0F766E` |
| Secondary Teal | `#14B8A6` |
| Accent Amber | `#F59E0B` |
| Success | `#22C55E` |
| Danger | `#EF4444` |
| Light BG | `#F8FAFC` |
| Dark Navy | `#0F172A` |
| Dark Card | `#1E293B` |

## Notes

- Keep `server` running while testing.
- Uploaded files are served from `http://<API>/uploads/...`
- Do not edit `client/` or `server/` when working on this mobile app.
