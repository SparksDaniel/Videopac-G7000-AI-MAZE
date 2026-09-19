# AI-MAZE – Game Specification

## 1. Overview

AI-MAZE is a single-player game for the Philips Videopac G7000/Magnavox
Odyssey². The player must draw one continuous line through a maze and visit
all 42 cells exactly once.

The target platform is a PAL-based Videopac G7000 with the standard BIOS. The
game is distributed as a 4 KiB ROM and uses the same type of XROM data access
as Videopac games 31 and 40.

## 2. Game Rules

- The playfield consists of a 7 × 6 grid of cells.
- The cursor begins in a predefined starting cell for the current level.
- A move can only be made through an open passage into an orthogonally
  adjacent cell.
- A previously visited cell cannot be visited again.
- The level is complete when all 42 cells have been visited.
- An invalid move is ignored and does not affect the score.
- The joystick button restarts the current level and reduces the number of
  points available for that level by five, but never below 10 points.

## 3. Controls

- Joystick 1 up, right, down, and left moves the cursor.
- A new move is accepted only after the joystick has returned to its neutral
  position. This prevents unintended repeated moves.
- The Joystick 1 button restarts the current level.

## 4. Level Selection and Progression

- The game uses the BIOS `SELECT GAME` routine with its normal screen and sound.
- Pressing Enter on `SELECT GAME` starts level 1 immediately.
- Levels 1–9 are selected with one digit and start after a timeout of about
  three seconds.
- Pressing Space after the first digit confirms a single-digit level
  immediately; for example, `1` followed by Space starts level 1 without a
  timeout.
- Levels 01–09 can also be entered with two digits and start immediately.
- Levels 10–46 are selected with two digits and start immediately after the
  second digit.
- All other numbers are invalid and return to `SELECT GAME`.
- After completing levels 1–45, the completion celebration is played and the
  next level is loaded.
- Level 46 is the final level and remains loaded after it has been completed.
- When starting a level directly, the total score is reset and the selected
  level once again begins with a value of 100 points.

## 5. Levels

The game contains 46 deterministically generated levels. Every level must:

- be solvable;
- have exactly one solution from the specified starting cell;
- use all 42 cells;
- contain misleading passages and meaningful choices;
- meet the generator's minimum requirements for search states, traps, and
  distribution.

The original levels 1–31 are preserved byte for byte and in the same order.
Levels 32–46 are new expert variants with different wall graphs. Every new
level must at least match the difficulty score of the original level 31, and
the expert group is sorted in ascending order by the generator's difficulty
score.

### 5.1 Binary Level Format

Each level uses 22 bytes:

| Offset | Size | Contents |
| --- | ---: | --- |
| 0 | 1 byte | Starting cell, 0–41 |
| 1 | 21 bytes | Two four-bit movement masks per byte |

The movement-mask bits are `1=up`, `2=right`, `4=down`, and `8=left`.
The file `roms/levels_46_7x6.bin` must therefore always be
46 × 22 = 1012 bytes. The grid walls are created from the movement masks when
a level is loaded, so the visible walls and permitted moves always use the
same data source.

The XROM reader must read the current byte before incrementing the address
pointer. This is necessary when any part of a level crosses an
`$xxFF/$xx00` boundary.

## 6. Scoring

The score is stored and displayed as four-digit packed BCD.

A level awards 100 points if completed without a restart. Every restart
reduces the level score by five: 95, 90, 85, and so on. The score has a floor
of 10, so a completed level always awards at least 10 points. Invalid moves do
not affect the score.

The four score digits and two level digits are displayed continuously at the
bottom of the screen using the VDC quad objects. No colon is displayed between
the score digits. The two interleaved score quads begin at X position `$20`;
the level display retains its separate position.

## 7. Graphics and Layout

- The background is black.
- The maze walls are normally bright yellow and are built with the VDC grid
  function.
- Visited cells are shown with a cyan fill symbol.
- The current cell is shown in white and is also marked by a white diamond
  sprite.
- The entire maze is positioned one grid row lower than in the original
  prototype.
- The 7 × 6 playfield begins at grid column 1 and is shifted one column to the
  left compared with the first 7 × 6 prototype.
- The fill symbols and white cursor have a shared X base of `$1D`, one pixel to
  the right of the grid origin, for optical centering within the cells.
- The `AI-MAZE` title is displayed above the maze, moved upward and shifted to
  the left.
- The letters use the same 16-step spacing. The hyphen is placed between `I`
  and `M`.

### 7.1 VDC Objects

| Resource | Use |
| --- | --- |
| Characters 0–4 | The letters `AIMAZ` |
| Characters 5–11 | Raster-multiplexed fill symbols for 42 cells |
| Sprite 0 | Diamond cursor |
| Sprite 1 | The hyphen in `AI-MAZE` |
| Sprite 2 | The letter `E` in `AI-MAZE` |
| Quads 0–1 | Four score digits, interleaved |
| Quads 2–3 | Two level digits |

Characters 5–11 are reused across six raster rows through timer interrupts.
Changes to this routine must retain equal execution time for empty, visited,
and current cells. The high bit of the shape pointer in the character
attribute must never be overwritten by a color change.

## 8. Sound and Completion Celebration

- The standard BIOS sound must play on `SELECT GAME`.
- The transition from `SELECT GAME` to the game itself must be silent.
- Movement, invalid moves, and manual restarts must not produce any sound.
- When a level is completed, the familiar five-tone sequence from the BIOS
  `SELECT GAME` sound is played as five separate tone blocks.
- During the five tone blocks, the walls and fill symbols change color, but
  the shapes of the symbols must never change.

The celebration color pairs are:

| Tone | Walls | Symbols/cursor |
| ---: | --- | --- |
| 1 | Green | Red |
| 2 | Red | Yellow |
| 3 | Yellow | Blue |
| 4 | Blue | Green |
| 5 | Brown, dark-yellow grid | Red |

VDC characters and sprites can only use bright colors. Brown is therefore
used only for the grid walls by selecting yellow without the intensity bit.

## 9. Memory and ROM Layout

| Area | Use |
| --- | --- |
| `$0000–$03F3` | 46 level records in XROM, 1012 bytes in total |
| `$0400–$0B9F` | Program code and fixed code blocks with internal gaps |
| `$0BFF` | End marker |
| `$0C00–$0C73` | Routine that creates grid walls from movement masks |
| `$0C80–$0CA5` | Start dispatcher for level selection and direct start with Enter |

The ROM file must be exactly 4096 bytes. There are 12 free bytes between the
level data and code, and 870 free bytes after the grid routine and start
dispatcher. There are also gaps between some fixed `org` sections. Internal
RAM `$27–$2C` is currently free, but BIOS-reserved `$3D–$3F` must not be used.

External RAM is used as follows:

- `$00–$29`: 42 bytes of display state, `0=empty`, `1=visited`, `2=current`;
- `$2A–$53`: 42 bytes of movement masks.

## 10. Building and Running

Build from the project directory with:

```text
build_maze_line_42.cmd
```

The build must:

1. preserve the original 31 levels and generate 15 expert levels;
2. create `roms/levels_46_7x6.bin` and `roms/levels_46_7x6.txt`;
3. assemble a 4096-byte ROM;
4. write `roms/ai-maze-42-46levels.rom`.

The `run_7x6_o2em118.cmd` launcher points to the 46-level ROM for the 7 × 6
version. The reference emulator is O2EM 1.18 in PAL mode with a European
G7000 BIOS.

## 11. Acceptance Criteria and Regression Tests

- `SELECT GAME` is displayed correctly and plays only the standard BIOS sound.
- Levels 1–9 start after the timeout; levels 10–46 start after two key presses.
- Space confirms levels 1–9 immediately after the first digit.
- Both level digits and all four score digits remain visible at all times.
- `AI-MAZE` is displayed in full without overwriting the level or score.
- All 46 levels can be started directly and are uniquely solvable.
- Level data is read correctly across every XROM `$xxFF/$xx00` boundary.
- No wall segments are displayed outside the maze's outer boundary.
- Fill symbols are displayed correctly on all six rows without flickering,
  clipping, or changing into letters such as `W`.
- After completing levels 1–45, the level number increases and the next level
  record is loaded.
- No continuous tone can be heard when the game starts or during normal play.
- A manual restart must not briefly display a white symbol in the upper-left
  cell; the raster timer must be disabled while the level data is rebuilt.
- The completion melody has five tone blocks, and the color sequence follows
  each tone.
- The ROM file is exactly 4096 bytes and `levels_46_7x6.bin` is exactly
  1012 bytes.

## 12. Important Project Files

- `maze_line_42.a48` – Intel 8048 source code.
- `tools/assemble.js` – local two-pass assembler for the MCS-48 subset used.
- `tools/generate_maze_levels_42.js` – deterministic level generator.
- `tools/verify_maze_levels_42.js` – standalone structural and solution
  verifier.
- `build_maze_line_42.cmd` – complete build workflow.
- `run_7x6_o2em118.cmd` – launches the 7 × 6 ROM in O2EM 1.18.
- `roms/levels_46_7x6.txt` – generator report and solution path for each level.
- `roms/ai-maze-42-46levels.rom` – completed game ROM.
