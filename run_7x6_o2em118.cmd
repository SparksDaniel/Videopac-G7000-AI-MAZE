@echo off
setlocal

set "GAME_ROM=%~dp0roms\ai-maze-42-46levels.rom"
set "SCREENSHOT=%~dp0docs\images\ai-maze-snapshot@.bmp"
set "O2EM_EXE="

if not "%~1"=="" goto :use_o2em_argument
if defined O2EM_DIR goto :use_configured_o2em
if exist "%~dp0o2em118win\o2em.exe" goto :use_local_o2em
for %%I in (o2em.exe) do set "O2EM_EXE=%%~$PATH:I"
if not defined O2EM_EXE goto :o2em_missing
goto :launch

:use_o2em_argument
set "O2EM_EXE=%~1"
if not exist "%O2EM_EXE%" goto :o2em_missing
goto :launch

:use_configured_o2em
set "O2EM_EXE=%O2EM_DIR%\o2em.exe"
if not exist "%O2EM_EXE%" goto :o2em_missing
goto :launch

:use_local_o2em
set "O2EM_EXE=%~dp0o2em118win\o2em.exe"

:launch
if not exist "%GAME_ROM%" (
  echo Missing ROM: %GAME_ROM%
  echo Run build_maze_line_42.cmd first.
  pause
  exit /b 1
)

for %%I in ("%O2EM_EXE%") do set "O2EM_HOME=%%~dpI"
pushd "%O2EM_HOME%"
"%O2EM_EXE%" "%GAME_ROM%" -exrom -euro -s1=UP,DOWN,LEFT,RIGHT,SPACE "-scshot=%SCREENSHOT%"
set "O2EM_EXIT=%ERRORLEVEL%"
popd
exit /b %O2EM_EXIT%

:o2em_missing
echo O2EM was not found.
echo Pass the full path to o2em.exe as the first argument, put O2EM on PATH,
echo place o2em118win next to this script, or set O2EM_DIR.
pause
exit /b 1
