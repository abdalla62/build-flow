# Run BUILD FLOW mobile against local API (Android emulator → host:5000).
# Start server first:  cd ..\server; npm run dev
Set-Location $PSScriptRoot\..
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
