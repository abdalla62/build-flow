# BuildFlow Mobile — Run Guide (Windows)

## Why build failed before

Error:
```text
'C:\Users\abdul\Flutter' is not recognized as an internal or external command
```

Cause: Flutter was installed in a path **with spaces**:
`C:\Users\abdul\Flutter Folder\flutter`

Windows split the path at the space.

## Fix already prepared

1. Flutter shortcut (no spaces): `C:\flutter`
2. Project shortcut (no spaces): `C:\buildflow\mobile`

## Permanent PATH (do once)

1. Windows Search → **Environment Variables**
2. Edit **Path**
3. Remove old entry like:
   `C:\Users\abdul\Flutter Folder\flutter\bin`
4. Add:
   `C:\flutter\bin`
5. OK → close all terminals → open new PowerShell

Check:
```powershell
where.exe flutter
flutter --version
```
Should show `C:\flutter\bin\flutter.bat`

## Run on emulator (every time)

Terminal 1 — backend:
```powershell
cd "C:\System ProjectConstruction Materia\server"
npm run dev
```

Terminal 2 — app (use space-free path):
```powershell
cd C:\buildflow\mobile
flutter run -d emulator-5554
```

First build can take 5–10 minutes. Later builds are faster.

## If you still use the old Flutter path

Do **not** run from:
`C:\Users\abdul\Flutter Folder\...`

Always use:
`C:\flutter\bin\flutter`
