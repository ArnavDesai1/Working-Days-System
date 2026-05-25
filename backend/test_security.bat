@echo off
REM Security Testing Script for Working Days System
REM Tests all critical security fixes

echo.
echo ========================================
echo SECURITY TEST SUITE
echo ========================================
echo.

REM Colors would be nice, but Windows batch doesn't support them natively
REM So we'll use text markers instead

set BACKEND_URL=http://localhost:8000
set FRONTEND_URL=http://localhost:5173

echo [TEST 1] Client Data Should NOT Be Visible Without Authentication
echo.
echo Running: curl.exe -s %BACKEND_URL%/api/clients/
echo Expected: 401 Unauthorized (Authentication credentials were not provided)
echo.
curl.exe -s %BACKEND_URL%/api/clients/ | findstr /R "Authentication"
if %ERRORLEVEL% EQU 0 (
    echo [PASS] ✓ Client endpoint is protected
) else (
    echo [FAIL] ✗ Client endpoint is NOT protected - SECURITY RISK!
)
echo.

echo ========================================
echo [TEST 2] Token Response Should NOT Contain Password Fields
echo.
echo Running: Login request to get token
echo Expected: User data WITHOUT password, password_expires_at, etc.
echo.

REM First, get a token (you'll need valid credentials)
echo NOTE: This test requires valid credentials in the database
echo Expected response format:
echo {
echo   "access": "token...",
echo   "refresh": "token...",
echo   "user": {
echo     "id": 1,
echo     "email": "test@example.com",
echo     "first_name": "Test",
echo     "role": "admin",
echo     "is_active": true
echo   },
echo   "password_expires_in_days": 87,
echo   "password_expires_at": "2025-03-15T...",
echo   "must_reset_password": false
echo }
echo.
echo After login, check the Network tab in DevTools:
echo - Click the login response
echo - Search for: "password" or "password_expires_at" in the user object
echo - If found in user object: ✗ VULNERABLE
echo - If NOT found: ✓ SECURE
echo.

echo ========================================
echo [TEST 3] Rate Limiting on Login Endpoint
echo.
echo Running: Rapid login attempts (should throttle after 5)
echo.
set attempt=1
for /l %%i in (1,1,10) do (
    echo Attempt %%i:
    curl.exe -s -X POST %BACKEND_URL%/api/token/ ^
        -H "Content-Type: application/json" ^
        -d "{\"email\":\"test@example.com\",\"password\":\"invalid\"}" ^
        | findstr "throttled\|too many"
    if !ERRORLEVEL! EQU 0 (
        echo [THROTTLED] ✓ Rate limiting working after %%i attempts
        goto rate_limit_done
    )
)
:rate_limit_done
echo.

echo ========================================
echo [TEST 4] CORS Should Block Non-Whitelisted Origins
echo.
echo To test CORS:
echo 1. Open browser DevTools Console
echo 2. Paste this JavaScript:
echo.
echo ^^(async ^(^) =^> {
echo   const response = await fetch('http://localhost:8000/api/clients/', {
echo     headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' }
echo   }^);
echo   console.log('CORS Status:', response.status^);
echo }^)^(^)
echo.
echo If Access-Control-Allow-Origin header is missing: ✓ SECURE
echo If it shows a non-whitelisted origin: ✗ VULNERABLE
echo.

echo ========================================
echo [TEST 5] Postman Should Be Blocked by CORS
echo.
echo To test with Postman:
echo 1. Send request to: %BACKEND_URL%/api/clients/
echo 2. Add header: Authorization: Bearer YOUR_TOKEN_HERE
echo 3. Result should show CORS error if using browser
echo.

echo ========================================
echo MANUAL TESTING CHECKLIST
echo ========================================
echo.
echo [ ] 1. Try accessing clients list without logging in
echo      Expected: 401 Unauthorized
echo.
echo [ ] 2. Login and check token response
echo      Expected: No password field in user object
echo.
echo [ ] 3. Login 10 times rapidly from frontend
echo      Expected: After 5 attempts, get throttled error
echo.
echo [ ] 4. Try from Postman without authentication
echo      Expected: 401 Unauthorized
echo.
echo [ ] 5. Try from Postman with valid token
echo      Expected: Works (no CORS issue for server-to-server)
echo.
echo [ ] 6. Email form field should be empty on page load
echo      Expected: No preloaded email visible
echo.
echo [ ] 7. Click save button on any form
echo      Expected: Toast notification confirming save
echo.

echo.
echo ========================================
echo To fully test, start the server:
echo   python manage.py runserver
echo And the frontend:
echo   npm run dev
echo ========================================
echo.
