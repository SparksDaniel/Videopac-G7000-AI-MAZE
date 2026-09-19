#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const WIDTH = 7, HEIGHT = 6, CELLS = WIDTH * HEIGHT;
const RECORD_BYTES = 22, LEVELS = 46;
const ALL = (1n << BigInt(CELLS)) - 1n;
const opposite = {1: 4, 2: 8, 4: 1, 8: 2};
const bit = cell => 1n << BigInt(cell);

function neighbours(cell) {
  const x = cell % WIDTH, y = (cell / WIDTH) | 0, out = [];
  if (y) out.push([cell - WIDTH, 1]);
  if (x < WIDTH - 1) out.push([cell + 1, 2]);
  if (y < HEIGHT - 1) out.push([cell + WIDTH, 4]);
  if (x) out.push([cell - 1, 8]);
  return out;
}

function legalMoves(masks, cell, visited) {
  return neighbours(cell).filter(([next, direction]) =>
    (masks[cell] & direction) && !(visited & bit(next))).map(([next]) => next);
}

function residualOK(masks, current, visited) {
  const residual = (ALL & ~visited) | bit(current);
  if (residual === bit(current)) return true;
  const degree = cell => neighbours(cell).reduce((sum, [next, direction]) =>
    sum + (((masks[cell] & direction) && (residual & bit(next))) ? 1 : 0), 0);
  if (!degree(current)) return false;
  let leaves = 0;
  for (let cell = 0; cell < CELLS; cell++) {
    if (cell === current || !(residual & bit(cell))) continue;
    const d = degree(cell);
    if (!d || (d === 1 && ++leaves > 1)) return false;
  }
  let seen = bit(current), stack = [current];
  while (stack.length) {
    const cell = stack.pop();
    for (const [next, direction] of neighbours(cell)) {
      const flag = bit(next);
      if ((masks[cell] & direction) && (residual & flag) && !(seen & flag)) {
        seen |= flag;
        stack.push(next);
      }
    }
  }
  return seen === residual;
}

function solutionCount(masks, start) {
  const memo = new Map();
  function walk(cell, visited) {
    const key = `${cell}:${visited.toString(16)}`;
    if (memo.has(key)) return memo.get(key);
    if (visited === ALL) return 1;
    let count = 0;
    for (const next of legalMoves(masks, cell, visited)) {
      const nextVisited = visited | bit(next);
      if (!residualOK(masks, next, nextVisited)) continue;
      count += walk(next, nextVisited);
      if (count > 1) return 2;
    }
    memo.set(key, count);
    return count;
  }
  return walk(start, bit(start));
}

const binName = process.argv[2] || path.join("roms", "levels_46_7x6.bin");
const reportName = process.argv[3] || path.join("roms", "levels_46_7x6.txt");
const data = fs.readFileSync(binName);
const lines = fs.readFileSync(reportName, "utf8").trim().split(/\r?\n/);
if (data.length !== LEVELS * RECORD_BYTES)
  throw new Error(`Expected ${LEVELS * RECORD_BYTES} bytes, got ${data.length}`);
if (lines.length !== LEVELS) throw new Error(`Expected ${LEVELS} report lines`);

let previousDifficulty = -Infinity;
for (let level = 0; level < LEVELS; level++) {
  const offset = level * RECORD_BYTES, start = data[offset];
  if (start >= CELLS) throw new Error(`Level ${level + 1}: invalid start ${start}`);
  const masks = [];
  for (let i = 1; i < RECORD_BYTES; i++) {
    const packed = data[offset + i];
    masks.push(packed & 15, packed >> 4);
  }
  for (let cell = 0; cell < CELLS; cell++) {
    const valid = neighbours(cell).reduce((value, [, direction]) => value | direction, 0);
    if (masks[cell] & ~valid)
      throw new Error(`Level ${level + 1}: passage leaves board at cell ${cell}`);
    for (const [next, direction] of neighbours(cell)) {
      if (!!(masks[cell] & direction) !== !!(masks[next] & opposite[direction]))
        throw new Error(`Level ${level + 1}: non-reciprocal edge ${cell}-${next}`);
    }
  }
  const match = lines[level].match(/path=([0-9,]+)$/);
  if (!match) throw new Error(`Level ${level + 1}: missing report path`);
  const difficultyMatch = lines[level].match(/score=([0-9.]+)/);
  if (!difficultyMatch) throw new Error(`Level ${level + 1}: missing difficulty score`);
  const difficulty = Number(difficultyMatch[1]);
  if (difficulty < previousDifficulty)
    throw new Error(`Level ${level + 1}: difficulty ${difficulty} is below previous level ${previousDifficulty}`);
  previousDifficulty = difficulty;
  const reported = match[1].split(",").map(Number);
  if (reported.length !== CELLS || new Set(reported).size !== CELLS || reported[0] !== start)
    throw new Error(`Level ${level + 1}: invalid reported Hamiltonian path`);
  for (let i = 1; i < CELLS; i++) {
    const edge = neighbours(reported[i - 1]).find(([next]) => next === reported[i]);
    if (!edge || !(masks[reported[i - 1]] & edge[1]))
      throw new Error(`Level ${level + 1}: reported path crosses a wall`);
  }
  if (solutionCount(masks, start) !== 1)
    throw new Error(`Level ${level + 1}: level is not uniquely solvable`);
}

console.log(`${binName}: ${LEVELS} structurally valid, uniquely solvable 7x6 levels`);
