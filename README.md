# BUILD FLOW

Construction Material Procurement Management System.

## Structure

- `server/` — Node.js / Express API + MongoDB
- `client/` — React (Vite) web app
- `mobile/` — Flutter mobile app
- `docs/` — project documentation

## Setup (local)

### Server
```bash
cd server
cp .env.example .env
# fill MongoDB, JWT, SMTP, Waafi, etc.
npm install
npm run dev
```

### Web
```bash
cd client
npm install
npm run dev
```

### Mobile
```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
```

## Security

Do not commit `.env`. Use `server/.env.example` as a template.
