#!/usr/bin/env node
"use strict";

// Reorder an already generated 46-level set by the generator's reported
// difficulty without spending several minutes regenerating identical levels.

const fs = require("fs");
const path = require("path");

const BASE_LEVELS = 31, LEVELS = 46, RECORD_BYTES = 22;
const binName = process.argv[2] || path.join("roms", "levels_46_7x6.bin");
const reportName = process.argv[3] || path.join("roms", "levels_46_7x6.txt");
const data = fs.readFileSync(binName);
const lines = fs.readFileSync(reportName, "utf8").trim().split(/\r?\n/);

if (data.length !== LEVELS * RECORD_BYTES)
  throw new Error(`Expected ${LEVELS * RECORD_BYTES} bytes, got ${data.length}`);
if (lines.length !== LEVELS)
  throw new Error(`Expected ${LEVELS} report lines, got ${lines.length}`);

const levels = lines.map((line, index) => {
  const match = line.match(/score=([0-9.]+)/);
  if (!match) throw new Error(`Level ${index + 1}: missing difficulty score`);
  return {
    originalIndex: index,
    difficulty: Number(match[1]),
    line,
    record: data.subarray(index * RECORD_BYTES, (index + 1) * RECORD_BYTES)
  };
});

const baseLevels = levels.slice(0, BASE_LEVELS);
const expertLevels = levels.slice(BASE_LEVELS)
  .sort((a, b) => a.difficulty - b.difficulty || a.originalIndex - b.originalIndex);
const sortedLevels = baseLevels.concat(expertLevels);
fs.writeFileSync(binName, Buffer.concat(sortedLevels.map(level => level.record)));
fs.writeFileSync(reportName,
  sortedLevels.map((level, index) => level.line.replace(/^\d+:/, `${index + 1}:`)).join("\n") + "\n");

console.log(`${binName}: preserved levels 1-${BASE_LEVELS} and sorted expert levels ${BASE_LEVELS + 1}-${LEVELS}`);
