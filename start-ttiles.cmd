@echo off
rem start-ttiles.cmd: one double-click starts the TTiles floor (Windows). See docs/INSTALL.md.
rem It starts the server if none is running (the built copy in dist\, or it builds one first), waits until it answers,
rem then opens Microsoft Edge full screen on the stage in install mode, in its own profile folder (.deploy\kiosk-profile),
rem so the two flags below never touch anyone's own browser:
rem   --autoplay-policy=no-user-gesture-required   sound plays with no key press or click
rem   --use-fake-ui-for-media-stream               the camera is allowed with no question. It does not fake the camera.
rem   --kiosk                                      full screen with no address bar. Alt+F4 closes it.
rem Closing the window also stops the server this script started. A server that was already running is left alone.
rem Settings, all optional: TTILES_PORT (default 5173), TTILES_EDGE_ARGS (extra browser flags, for checks).
rem "start-ttiles.cmd rebuild" throws the built copy away first, after the code changed.
setlocal
cd /d "%~dp0"
if "%TTILES_PORT%"=="" set TTILES_PORT=5173
set "URL=http://localhost:%TTILES_PORT%/stage.html"
set "STARTED="

set "EDGE="
for %%p in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do if exist %%p set "EDGE=%%~p"
if not defined EDGE (
  echo Microsoft Edge was not found on this laptop. Install Edge, then double-click this file again.
  pause
  exit /b 1
)

if /i "%~1"=="rebuild" if exist dist rd /s /q dist

call :answers
if not errorlevel 1 (
  echo TTiles is already running on port %TTILES_PORT%. Using it.
  goto open
)

if exist dist\stage.html (
  echo Starting the built copy in dist on port %TTILES_PORT%.
) else (
  echo There is no built copy yet. Building it first, this takes about a minute.
  call npm.cmd run build
  if errorlevel 1 (
    echo The build failed. Read the lines above. If they say a package is missing, run npm.cmd install once, then double-click this file again.
    pause
    exit /b 1
  )
)
start "TTiles server" /min cmd /c npx.cmd vite preview --port %TTILES_PORT% --strictPort
set "STARTED=1"

for /l %%i in (1,1,60) do (
  call :answers
  if not errorlevel 1 goto open
  ping -n 2 127.0.0.1 >nul
)
echo The server did not answer in 60 seconds. Close any window titled TTiles server, check that port %TTILES_PORT% is free, and try again.
pause
exit /b 1

:open
echo Opening the stage full screen. Press Alt+F4 to close it.
start "" /wait "%EDGE%" --user-data-dir="%~dp0.deploy\kiosk-profile" --kiosk "%URL%?install=1" --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --no-first-run --no-default-browser-check %TTILES_EDGE_ARGS%
if defined STARTED (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%TTILES_PORT% .*LISTENING"') do taskkill /f /t /pid %%p >nul 2>&1
  echo TTiles stopped.
)
exit /b 0

rem Exit code 0 when a TTiles stage page is served on the port.
:answers
curl.exe -s -f "%URL%" 2>nul | findstr /c:"TTiles" >nul
exit /b %errorlevel%
