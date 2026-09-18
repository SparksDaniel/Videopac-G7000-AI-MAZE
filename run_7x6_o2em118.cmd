@echo off
setlocal

set "GAME_ROM=%~dp0roms\ai-maze-42-31levels.rom"
set "O2EM_EXE=o2em.exe"

if defined O2EM_DIR (
  set "O2EM_EXE=%O2EM_DIR%\o2em.exe"
  if not exist "%O2EM_DIR%\o2em.exe" goto :o2em_missing
) else (
  where o2em.exe >nul 2>nul
  if errorlevel 1 goto :o2em_missing
)

if not exist "%GAME_ROM%" (
  echo Missing ROM: %GAME_ROM%
  echo Run build_maze_line_42.cmd first.
  pause
  exit /b 1
)

"%O2EM_EXE%" "%GAME_ROM%" -exrom -euro -s1=UP,DOWN,LEFT,RIGHT,SPACE
exit /b %ERRORLEVEL%

:o2em_missing
echo O2EM was not found.
echo Set O2EM_DIR to the directory containing o2em.exe, for example:
echo set O2EM_DIR=C:\Emulators\o2em118win
pause
exit /b 1
