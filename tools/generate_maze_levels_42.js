#!/usr/bin/env node
"use strict";

// Build 46 deterministic levels from an embedded 31-level seed set and 15
// generated variants. Each record is one start cell followed by 21 packed
// movement-mask bytes. The cartridge derives the VDC grid walls from these
// masks while loading a level.
const fs = require("fs");
const path = require("path");
const BASE_LEVELS = 31;
const count = 46;
const WIDTH = 7;
const HEIGHT = 6;
const CELLS = WIDTH * HEIGHT;
const RECORD_BYTES = 1 + CELLS / 2;
const ALL = (1n << BigInt(CELLS)) - 1n;
const BASE_LEVEL_DATA = Buffer.from(
  "F+bu7ny7v5/n/nxccf9d57//Pbu6mxnm7u58v//b13Tvfb//35f2fT26u5sY5u7uPL/f1/b+/32/eZ/3LP88u7qbEObO5lz3/9/3+111Lf/b1/bvPZuzmxnm7q54XffO99/XdT3/2/f+7z27u5sS5u6ufP+f1nX//n3//13X8/89i7ObF8Lm7mz/XZf3//tc1+eft/99PLq7mxGm7mh82uff5///PX3/3/b7PT2ru5oR5mjuPO+/39b3/l33/9/XdX09u7ubGObu7nxd15d1//88ff/f9vv/PYuTkxlkbO5c97/f9//+ff99n5e3/zy6upsY5u4sfP//3tfz33XP89+37/89urubEObu7nyf15f3+v88Lf/f1vbfNbu7mxnm7u58/3nb9+/vXff/3/e/PT2bspoS5u6ufJv33sf223X/j9f3//49u7ubEqbu7nz+/5/3n7c8//7e9r//Obu6ixfmbO58ff/f999xff/vn3V9fTy7u5sZ5u7uWPf7z/fv/3nf18P3/+89ObubGebuznS//9/X9v99/79d19f2PZuzmxDm7u58ff/b9z1tffv+34e3vz26upoQ5uruXOffl/d9/xz3n9f2//49u7ubGeZornzv/96X87997v/eNd/XNbq7mxnm7u58/31d87//bf943/fv/z27OZsY5u7ufP//2/P/72n/Hcf3//49ObubEIbm7nz++9917/89///f1vd9Pbs5mxem7u58+vvf56//fd/y3/fv/z05OZsXpu5sfP7/23X/bX2//9/X8v89q7ubF8bi7nzLdZ/n//9c95/X9//+PTm7mxfmru58ff7b9//PMf//z/a//z27upsY5izuXPf+2/f/733//9v3/+89m5OTEeZsznT//1n3/+99/79ddX3+Pbu7mw==",
  "base64"
);
let seed = 0x46c0ffee;
const rnd = n => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n);
const cellBit = cell => 1n << BigInt(cell);
const opposite = {1: 4, 2: 8, 4: 1, 8: 2};

function neighbours(cell) {
  const x = cell % WIDTH, y = (cell / WIDTH) | 0, out = [];
  if (y) out.push([cell - WIDTH, 1]);
  if (x < WIDTH - 1) out.push([cell + 1, 2]);
  if (y < HEIGHT - 1) out.push([cell + WIDTH, 4]);
  if (x) out.push([cell - 1, 8]);
  return out;
}

function makePath() {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const start = [16, 17, 18, 23, 24, 25][rnd(6)], pathCells = [start], used = new Set(pathCells);
    function walk(cell, previousDelta) {
      if (pathCells.length === CELLS) return true;
      const choices = neighbours(cell).filter(([n]) => !used.has(n)).map(item => ({
        item,
        onward: neighbours(item[0]).filter(([n]) => !used.has(n)).length,
        straight: item[0] - cell === previousDelta ? 1 : 0,
        tie: rnd(2048)
      }));
      // Avoid isolated cells, but strongly prefer bends over the obvious
      // row-by-row snakes produced by a pure Warnsdorff ordering.
      choices.sort((a, b) =>
        (a.straight * 1200 + a.onward * 40 + a.tie) -
        (b.straight * 1200 + b.onward * 40 + b.tie));
      for (const {item: [next]} of choices) {
        used.add(next); pathCells.push(next);
        if (walk(next, next - cell)) return true;
        pathCells.pop(); used.delete(next);
      }
      return false;
    }
    if (walk(start, 0)) return pathCells;
  }
  throw new Error("Could not generate Hamiltonian path");
}

function legalMoves(masks, cell, visited) {
  return neighbours(cell).filter(([next, bit]) =>
    (masks[cell] & bit) && !(visited & cellBit(next))).map(([next]) => next);
}

function residualOK(masks, current, visited) {
  const residual = (ALL & ~visited) | cellBit(current);
  if (residual === cellBit(current)) return true;
  const degree = cell => neighbours(cell).reduce((sum, [next, bit]) =>
    sum + (((masks[cell] & bit) && (residual & cellBit(next))) ? 1 : 0), 0);
  if (!degree(current)) return false;
  let leaves = 0;
  for (let cell = 0; cell < CELLS; cell++) if (cell !== current && (residual & cellBit(cell))) {
    const d = degree(cell);
    if (!d || (d === 1 && ++leaves > 1)) return false;
  }
  let seen = cellBit(current), stack = [current];
  while (stack.length) {
    const cell = stack.pop();
    for (const [next, bit] of neighbours(cell)) {
      const flag = cellBit(next);
      if ((masks[cell] & bit) && (residual & flag) && !(seen & flag)) {
        seen |= flag; stack.push(next);
      }
    }
  }
  return seen === residual;
}

function searchEffort(masks, start, limit = Infinity) {
  const memo = new Map();
  let uniqueStates = 0, deepestDead = 0, lateDead = 0;
  function walk(cell, visited, depth) {
    const key = `${cell}:${visited.toString(16)}`;
    if (memo.has(key)) return memo.get(key);
    uniqueStates++;
    if (visited === ALL) return 1;
    let solutions = 0, viableChildren = 0;
    for (const next of legalMoves(masks, cell, visited)) {
      const nextVisited = visited | cellBit(next);
      if (!residualOK(masks, next, nextVisited)) continue;
      viableChildren++;
      solutions += walk(next, nextVisited, depth + 1);
      if (solutions >= limit) { solutions = limit; break; }
    }
    if (!viableChildren) {
      deepestDead = Math.max(deepestDead, depth);
      if (depth >= 33) lateDead++;
    }
    memo.set(key, solutions);
    return solutions;
  }
  const solutions = walk(start, cellBit(start), 1);
  return {solutions, uniqueStates, deepestDead, lateDead};
}

function solutionCount(masks, start, limit = 2) {
  return searchEffort(masks, start, limit).solutions;
}

function solutionPath(masks, start) {
  const pathCells = [start];
  function walk(cell, visited) {
    if (visited === ALL) return true;
    for (const next of legalMoves(masks, cell, visited)) {
      const nextVisited = visited | cellBit(next);
      if (!residualOK(masks, next, nextVisited)) continue;
      pathCells.push(next);
      if (walk(next, nextVisited)) return true;
      pathCells.pop();
    }
    return false;
  }
  if (!walk(start, cellBit(start))) throw new Error(`No solution from cell ${start}`);
  return pathCells;
}

function trapMetrics(masks, pathCells) {
  let visited = 0n, meaningful = 0, immediate = 0, decisions = 0;
  let equalDegree = 0, deceptive = 0, gap = 0;
  const gaps = [], bins = [0, 0, 0], delays = [];
  function failureDelay(cell, seen, memo = new Map()) {
    const key = `${cell}:${seen.toString(16)}`;
    if (memo.has(key)) return memo.get(key);
    const children = [];
    for (const next of legalMoves(masks, cell, seen)) {
      const nextSeen = seen | cellBit(next);
      if (residualOK(masks, next, nextSeen)) children.push(failureDelay(next, nextSeen, memo));
    }
    const value = children.length ? 1 + children.reduce((a, b) => a + b, 0) / children.length : 0;
    memo.set(key, value);
    return value;
  }
  const residualDegree = (cell, seen) => legalMoves(masks, cell, seen).length;
  for (let i = 0; i < CELLS - 1; i++) {
    const cell = pathCells[i], correct = pathCells[i + 1];
    visited |= cellBit(cell);
    const options = legalMoves(masks, cell, visited);
    if (options.length > 1) decisions++;
    const correctSeen = visited | cellBit(correct);
    const correctDegree = residualDegree(correct, correctSeen);
    let hardHere = 0;
    for (const wrong of options) if (wrong !== correct) {
      const wrongSeen = visited | cellBit(wrong);
      const wrongDegree = residualDegree(wrong, wrongSeen);
      if (wrongDegree === correctDegree) equalDegree++;
      if (wrongDegree < correctDegree) deceptive++;
      if (!residualOK(masks, wrong, wrongSeen)) { immediate++; continue; }
      const delay = 1 + failureDelay(wrong, wrongSeen);
      delays.push(delay);
      if (delay >= 5) { meaningful++; hardHere++; }
    }
    if (hardHere) {
      bins[Math.min(2, (i / 14) | 0)] += hardHere;
      gaps.push(gap); gap = 0;
    } else gap++;
  }
  gaps.push(gap);
  delays.sort((a, b) => a - b);
  const percentile = p => delays.length ? delays[Math.floor((delays.length - 1) * p)] : 0;
  return {
    decisions, meaningful, immediate, equalDegree, deceptive, bins,
    trapP25: percentile(0.25), trapMedian: percentile(0.5),
    maxForcedGap: Math.max(...gaps)
  };
}

function difficultyOf(masks, pathCells) {
  const effort = searchEffort(masks, pathCells[0]);
  const traps = trapMetrics(masks, pathCells);
  const deltas = pathCells.slice(1).map((cell, i) => cell - pathCells[i]);
  let turns = 0, run = 1, maxRun = 1;
  for (let i = 1; i < deltas.length; i++) {
    if (deltas[i] !== deltas[i - 1]) { turns++; run = 1; }
    else maxRun = Math.max(maxRun, ++run);
  }
  const score = 24 * Math.log2(1 + effort.uniqueStates) +
    14 * traps.meaningful + 10 * traps.deceptive + 4 * traps.equalDegree +
    6 * traps.trapP25 + 3 * traps.trapMedian + 2 * traps.decisions -
    6 * traps.immediate - 7 * traps.maxForcedGap +
    12 * traps.bins[1] + 16 * traps.bins[2] + 2 * turns - 4 * maxRun;
  return {...effort, ...traps, turns, maxRun, score};
}

function baseMasksFor(pathCells) {
  const masks = Array(CELLS).fill(0);
  for (let i = 1; i < pathCells.length; i++) {
    const a = pathCells[i - 1], b = pathCells[i];
    const [, bit] = neighbours(a).find(([n]) => n === b);
    masks[a] |= bit; masks[b] |= opposite[bit];
  }
  return masks;
}

function masksFor(pathCells, variants = 16) {
  const base = baseMasksFor(pathCells);
  const candidates = [];
  for (let a = 0; a < CELLS; a++) for (const [b, bit] of neighbours(a))
    if (a < b && !(base[a] & bit)) candidates.push([a, b, bit]);
  let best = null;
  for (let variant = 0; variant < variants; variant++) {
    const order = candidates.slice();
    for (let i = order.length - 1; i; i--) {
      const j = rnd(i + 1); [order[i], order[j]] = [order[j], order[i]];
    }
    const masks = base.slice();
    let extras = 0;
    const includeChance = variant < 10 ? 100 : 35 + rnd(66);
    for (const [a, b, bit] of order) {
      if (rnd(100) >= includeChance) continue;
      masks[a] |= bit; masks[b] |= opposite[bit];
      if (solutionCount(masks, pathCells[0]) === 1) extras++;
      else { masks[a] &= ~bit; masks[b] &= ~opposite[bit]; }
    }
    const difficulty = difficultyOf(masks, pathCells);
    if (!best || difficulty.score > best.difficulty.score)
      best = {masks, extras, difficulty};
  }
  return best;
}

function transformCell(cell, mode) {
  let x = cell % WIDTH, y = (cell / WIDTH) | 0;
  if (mode & 1) x = WIDTH - 1 - x;
  if (mode & 2) y = HEIGHT - 1 - y;
  return y * WIDTH + x;
}

function canonicalPath(pathCells) {
  const forms = [];
  for (let mode = 0; mode < 4; mode++)
    forms.push(pathCells.map(cell => transformCell(cell, mode).toString().padStart(2, "0")).join(""));
  return forms.sort()[0];
}

function canonicalGraph(masks, start) {
  const forms = [];
  for (let mode = 0; mode < 4; mode++) {
    const edges = [];
    for (let a = 0; a < CELLS; a++) for (const [b, bit] of neighbours(a)) if (a < b && (masks[a] & bit)) {
      const ta = transformCell(a, mode), tb = transformCell(b, mode);
      edges.push(`${Math.min(ta, tb).toString().padStart(2, "0")}${Math.max(ta, tb).toString().padStart(2, "0")}`);
    }
    edges.sort();
    forms.push(`${transformCell(start, mode).toString().padStart(2, "0")}:${edges.join("")}`);
  }
  return forms.sort()[0];
}

function transformLevel(pathCells, masks, mode) {
  const transformedMasks = Array(CELLS).fill(0);
  for (let a = 0; a < CELLS; a++) for (const [b, bit] of neighbours(a)) {
    if (a >= b || !(masks[a] & bit)) continue;
    const ta = transformCell(a, mode), tb = transformCell(b, mode);
    const edge = neighbours(ta).find(([next]) => next === tb);
    if (!edge) throw new Error("Transformed edge is not orthogonal");
    transformedMasks[ta] |= edge[1];
    transformedMasks[tb] |= opposite[edge[1]];
  }
  return {
    pathCells: pathCells.map(cell => transformCell(cell, mode)),
    masks: transformedMasks
  };
}

const qualifies = candidate => {
  const d = candidate.difficulty;
  return d.meaningful >= 5 && d.bins[1] >= 1 &&
    d.maxForcedGap <= 21 && d.uniqueStates >= 180 && d.score >= 211.8;
};
const baseData = BASE_LEVEL_DATA;
if (baseData.length !== BASE_LEVELS * RECORD_BYTES)
  throw new Error(`Expected ${BASE_LEVELS * RECORD_BYTES} base bytes, got ${baseData.length}`);

function decodeMasks(data, level) {
  const offset = level * RECORD_BYTES, masks = [];
  for (let i = 1; i < RECORD_BYTES; i++) {
    const packed = data[offset + i];
    masks.push(packed & 15, packed >> 4);
  }
  return masks;
}

function extraPassages(masks) {
  let edges = 0;
  for (let cell = 0; cell < CELLS; cell++)
    for (const [next, bit] of neighbours(cell))
      if (cell < next && (masks[cell] & bit)) edges++;
  return edges - (CELLS - 1);
}

const baseLevels = Array.from({length: BASE_LEVELS}, (_, level) => {
  const masks = decodeMasks(baseData, level);
  const start = baseData[level * RECORD_BYTES];
  const pathCells = solutionPath(masks, start);
  if (pathCells.length !== CELLS || pathCells[0] !== start || solutionCount(masks, start) !== 1)
    throw new Error(`Base level ${level + 1}: invalid or non-unique`);
  return {pathCells, masks, extras: extraPassages(masks), difficulty: difficultyOf(masks, pathCells)};
});

const baseReport = baseLevels.map(({pathCells, extras, difficulty}, level) =>
  `${level + 1}: start=${pathCells[0]} extras=${extras} states=${difficulty.uniqueStates} meaningful=${difficulty.meaningful} bins=${difficulty.bins.join("/")} p25=${difficulty.trapP25.toFixed(1)} gap=${difficulty.maxForcedGap} turns=${difficulty.turns} run=${difficulty.maxRun} score=${difficulty.score.toFixed(1)} path=${pathCells.join(",")}`
);
const expertFloor = baseLevels.at(-1).difficulty.score;
const graphKeys = new Set(baseLevels.map(level => canonicalGraph(level.masks, level.pathCells[0])));
const expertLevels = [];
const expertTarget = count - BASE_LEVELS;
const expertPerSource = new Map();
const expertSources = [30, 29, 28, 19]; // Seed levels 31, 30, 29 and 20.

// Reuse the hardest solution paths but construct different maximal passage
// graphs around them. A different graph means different walls and decisions;
// every graph is independently checked for one and only one full solution.
for (let round = 0; expertLevels.length < expertTarget && round < 96; round++) {
  for (const source of expertSources) {
    if (expertLevels.length >= expertTarget) break;
    const sourceCount = expertPerSource.get(source) || 0;
    if (sourceCount >= 12) continue;
    const sourcePath = baseLevels[source].pathCells;
    const generated = masksFor(sourcePath, 16);
    const orientation = (expertLevels.length + round + source) & 3;
    const transformed = transformLevel(sourcePath, generated.masks, orientation);
    const candidate = {
      pathCells: transformed.pathCells,
      masks: transformed.masks,
      extras: generated.extras,
      difficulty: generated.difficulty,
      sourceLevel: source + 1
    };
    const graphKey = canonicalGraph(candidate.masks, candidate.pathCells[0]);
    if (!qualifies(candidate) ||
        candidate.difficulty.score < expertFloor || graphKeys.has(graphKey)) continue;
    graphKeys.add(graphKey);
    expertLevels.push(candidate);
    expertPerSource.set(source, sourceCount + 1);
    console.log(`Expert ${expertLevels.length}/${expertTarget}: source=${source + 1} orientation=${orientation} score=${candidate.difficulty.score.toFixed(1)}`);
  }
}
if (expertLevels.length !== expertTarget)
  throw new Error(`Could only generate ${expertLevels.length} expert levels at score >= ${expertFloor.toFixed(1)}`);
expertLevels.sort((a, b) => a.difficulty.score - b.difficulty.score);

const records = [baseData], report = baseReport.slice();
for (let level = 0; level < expertLevels.length; level++) {
  const {pathCells, masks, extras, difficulty, sourceLevel} = expertLevels[level];
  if (solutionCount(masks, pathCells[0]) !== 1)
    throw new Error(`Selected expert level ${BASE_LEVELS + level + 1} is not uniquely solvable`);
  const packed = [];
  for (let i = 0; i < CELLS; i += 2) packed.push(masks[i] | (masks[i + 1] << 4));
  if (packed.length + 1 !== RECORD_BYTES) throw new Error("Internal record-size error");
  records.push(Buffer.from([pathCells[0], ...packed]));
  report.push(`${BASE_LEVELS + level + 1}: start=${pathCells[0]} source=${sourceLevel} extras=${extras} states=${difficulty.uniqueStates} meaningful=${difficulty.meaningful} bins=${difficulty.bins.join("/")} p25=${difficulty.trapP25.toFixed(1)} gap=${difficulty.maxForcedGap} turns=${difficulty.turns} run=${difficulty.maxRun} score=${difficulty.score.toFixed(1)} path=${pathCells.join(",")}`);
}
const out = process.argv[2] || path.join("roms", "levels_46_7x6.bin");
fs.writeFileSync(out, Buffer.concat(records));
const reportOut = path.join(path.dirname(out), `${path.basename(out, path.extname(out))}.txt`);
fs.writeFileSync(reportOut, report.join("\n") + "\n");
console.log(`${out}: ${count * RECORD_BYTES} bytes, ${count} verified levels`);
