@echo off
setlocal
node tools\generate_maze_levels_42.js roms\levels_46_7x6.bin
if errorlevel 1 exit /b 1
node tools\verify_maze_levels_42.js roms\levels_46_7x6.bin roms\levels_46_7x6.txt
if errorlevel 1 exit /b 1
node tools\assemble.js maze_line_42.a48 roms\ai-maze-42-46levels.rom --4k
if errorlevel 1 exit /b 1
for %%F in (roms\ai-maze-42-46levels.rom) do if not "%%~zF"=="4096" exit /b 1
echo Built roms\ai-maze-42-46levels.rom successfully.
