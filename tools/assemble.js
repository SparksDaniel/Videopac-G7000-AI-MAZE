#!/usr/bin/env node
"use strict";

// Small, dependency-free two-pass assembler for the MCS-48 subset used by
// MINI RACER. It intentionally rejects unknown syntax instead of guessing.

const fs = require("fs");
const path = require("path");

const input = process.argv[2] || "racer.a48";
const output = process.argv[3] || "racer.rom";
const source = fs.readFileSync(input, "utf8").replace(/\r/g, "");
const lines = source.split("\n");
const symbols = Object.create(null);

function clean(line) {
  return line.replace(/;.*/, "").trim();
}

function parseNumber(token) {
  token = token.trim().toLowerCase();
  if (/^[0-9a-f]+h$/.test(token)) return parseInt(token.slice(0, -1), 16);
  if (/^[0-9]+$/.test(token)) return parseInt(token, 10);
  return undefined;
}

function expression(text, allowUnknown = false) {
  const tokens = text.toLowerCase().replace(/\s/g, "").match(/[+-]?[^+-]+/g);
  if (!tokens) throw new Error(`Bad expression: ${text}`);
  let value = 0;
  for (const raw of tokens) {
    const sign = raw[0] === "-" ? -1 : 1;
    const token = /^[+-]/.test(raw) ? raw.slice(1) : raw;
    const number = parseNumber(token);
    if (number !== undefined) value += sign * number;
    else if (symbols[token] !== undefined) value += sign * symbols[token];
    else if (allowUnknown) return 0;
    else throw new Error(`Unknown symbol: ${token}`);
  }
  return value;
}

function splitInstruction(text) {
  const match = text.match(/^(\S+)(?:\s+(.*))?$/);
  return [match[1].toLowerCase(), (match[2] || "").trim().toLowerCase()];
}

function instructionSize(op, args) {
  if (op === "org" || op === "cpu") return 0;
  if (op === "incbin") {
    const file = args.replace(/^['\"]|['\"]$/g, "");
    return fs.statSync(path.resolve(path.dirname(input), file)).size;
  }
  if (op === "db") return args.split(",").length;
  if (["jmp", "call", "jz", "jnz", "jc", "jf0", "jtf", "djnz"].includes(op)) return 2;
  if (args.includes("#")) return 2;
  return 1;
}

let pc = 0;
for (let index = 0; index < lines.length; index++) {
  let line = clean(lines[index]);
  if (!line) continue;

  const equ = line.match(/^([a-z_][\w]*)\s+equ\s+(.+)$/i);
  if (equ) {
    symbols[equ[1].toLowerCase()] = expression(equ[2], false);
    continue;
  }

  const label = line.match(/^([a-z_][\w]*):(?:\s*(.*))?$/i);
  if (label) {
    symbols[label[1].toLowerCase()] = pc;
    line = (label[2] || "").trim();
    if (!line) continue;
  }

  const [op, args] = splitInstruction(line);
  if (op === "org") pc = expression(args, true);
  else pc += instructionSize(op, args);
}

const memory = new Uint8Array(0x1000);
memory.fill(0xff);
const written = new Uint8Array(0x1000);
pc = 0;
let highestWritten = 0;
let highestGameCode = 0;

function reg(value) {
  const match = value.match(/^r([0-7])$/);
  if (!match) throw new Error(`Expected register, got: ${value}`);
  return Number(match[1]);
}

function targetByte(value, lineNumber) {
  const address = expression(value);
  if ((address & 0xff00) !== (pc & 0xff00)) {
    throw new Error(`Line ${lineNumber}: branch crosses a 256-byte page`);
  }
  return address & 0xff;
}

function emit(...bytes) {
  for (const byte of bytes) {
    if (byte < 0 || byte > 255) throw new Error(`Byte out of range at ${pc.toString(16)}`);
    if (written[pc]) throw new Error(`Overlapping output at ${pc.toString(16)}`);
    written[pc] = 1;
    memory[pc++] = byte;
    highestWritten = Math.max(highestWritten, pc);
    if (pc < 0xbff) highestGameCode = Math.max(highestGameCode, pc);
  }
}

function jumpOpcode(base, address) {
  return base + (((address >> 8) & 7) << 5);
}

for (let index = 0; index < lines.length; index++) {
  let line = clean(lines[index]);
  if (!line || /^\w+\s+equ\s+/i.test(line)) continue;
  const label = line.match(/^([a-z_][\w]*):(?:\s*(.*))?$/i);
  if (label) {
    line = (label[2] || "").trim();
    if (!line) continue;
  }

  const [op, args] = splitInstruction(line);
  const operands = args ? args.split(",").map(x => x.trim()) : [];
  const lineNumber = index + 1;

  try {
    if (op === "cpu") continue;
    if (op === "org") { pc = expression(args); continue; }
    if (op === "incbin") {
      const file = args.replace(/^['\"]|['\"]$/g, "");
      for (const byte of fs.readFileSync(path.resolve(path.dirname(input), file))) emit(byte);
      continue;
    }
    if (op === "db") {
      for (const item of operands) emit(expression(item) & 0xff);
      continue;
    }
    if (op === "nop") { emit(0x00); continue; }
    if (op === "ret") { emit(0x83); continue; }
    if (op === "retr") { emit(0x93); continue; }
    if (op === "da" && args === "a") { emit(0x57); continue; }
    if (op === "sel" && args === "rb1") { emit(0xd5); continue; }
    if (op === "sel" && args === "rb0") { emit(0xc5); continue; }
    if (op === "sel" && args === "mb1") { emit(0xf5); continue; }
    if (op === "sel" && args === "mb0") { emit(0xe5); continue; }
    if (op === "stop" && args === "tcnt") { emit(0x65); continue; }
    if (op === "strt" && args === "cnt") { emit(0x45); continue; }
    if (op === "en" && args === "tcnti") { emit(0x25); continue; }
    if (op === "dis" && args === "tcnti") { emit(0x35); continue; }
    if (op === "in" && args === "a,p1") { emit(0x09); continue; }
    if (op === "in" && args === "a,p2") { emit(0x0a); continue; }
    if (op === "outl" && args === "p1,a") { emit(0x39); continue; }
    if (op === "outl" && args === "p2,a") { emit(0x3a); continue; }
    if (op === "inc" && args === "a") { emit(0x17); continue; }
    if (op === "dec" && args === "a") { emit(0x07); continue; }
    if (op === "rl" && args === "a") { emit(0xe7); continue; }
    if (op === "rr" && args === "a") { emit(0x77); continue; }
    if (op === "swap" && args === "a") { emit(0x47); continue; }
    if (op === "movp" && args === "a,@a") { emit(0xa3); continue; }
    if (op === "inc" && /^r[0-7]$/.test(args)) { emit(0x18 + reg(args)); continue; }
    if (op === "dec" && /^r[0-7]$/.test(args)) { emit(0xc8 + reg(args)); continue; }
    if (op === "jmp" || op === "call") {
      const address = expression(args);
      emit(jumpOpcode(op === "jmp" ? 0x04 : 0x14, address), address & 0xff);
      continue;
    }
    if (["jz", "jnz", "jc", "jf0", "jtf"].includes(op)) {
      emit({jz: 0xc6, jnz: 0x96, jc: 0xf6, jf0: 0xb6, jtf: 0x16}[op], targetByte(args, lineNumber));
      continue;
    }
    if (op === "djnz") {
      emit(0xe8 + reg(operands[0]), targetByte(operands[1], lineNumber));
      continue;
    }
    if (op === "mov") {
      const [dst, src] = operands;
      if (dst === "a" && src.startsWith("#")) { emit(0x23, expression(src.slice(1)) & 0xff); continue; }
      if (/^r[0-7]$/.test(dst) && src.startsWith("#")) { emit(0xb8 + reg(dst), expression(src.slice(1)) & 0xff); continue; }
      if (dst === "a" && /^r[0-7]$/.test(src)) { emit(0xf8 + reg(src)); continue; }
      if (/^r[0-7]$/.test(dst) && src === "a") { emit(0xa8 + reg(dst)); continue; }
      if (dst === "a" && /^@r[01]$/.test(src)) { emit(0xf0 + Number(src[2])); continue; }
      if (/^@r[01]$/.test(dst) && src === "a") { emit(0xa0 + Number(dst[2])); continue; }
      if (dst === "t" && src === "a") { emit(0x62); continue; }
    }
    if (op === "movx") {
      const [dst, src] = operands;
      if (/^@r[01]$/.test(dst) && src === "a") { emit(0x90 + Number(dst[2])); continue; }
      if (dst === "a" && /^@r[01]$/.test(src)) { emit(0x80 + Number(src[2])); continue; }
    }
    if (op === "add" && operands[0] === "a" && operands[1].startsWith("#")) {
      emit(0x03, expression(operands[1].slice(1)) & 0xff); continue;
    }
    if (op === "add" && operands[0] === "a" && /^r[0-7]$/.test(operands[1])) {
      emit(0x68 + reg(operands[1])); continue;
    }
    if (op === "anl" && operands[0] === "a" && operands[1].startsWith("#")) {
      emit(0x53, expression(operands[1].slice(1)) & 0xff); continue;
    }
    if (op === "anl" && operands[0] === "a" && /^r[0-7]$/.test(operands[1])) {
      emit(0x58 + reg(operands[1])); continue;
    }
    if (op === "xrl" && operands[0] === "a" && operands[1].startsWith("#")) {
      emit(0xd3, expression(operands[1].slice(1)) & 0xff); continue;
    }
    if (op === "xrl" && operands[0] === "a" && /^r[0-7]$/.test(operands[1])) {
      emit(0xd8 + reg(operands[1])); continue;
    }
    if (op === "orl" && operands[0] === "a" && /^r[0-7]$/.test(operands[1])) {
      emit(0x48 + reg(operands[1])); continue;
    }
    if (op === "orl" && operands[0] === "p1" && operands[1].startsWith("#")) {
      emit(0x89, expression(operands[1].slice(1)) & 0xff); continue;
    }
    if (op === "anl" && operands[0] === "p1" && operands[1].startsWith("#")) {
      emit(0x99, expression(operands[1].slice(1)) & 0xff); continue;
    }
    throw new Error(`Unsupported instruction: ${line}`);
  } catch (error) {
    if (!String(error.message).startsWith("Line ")) {
      error.message = `Line ${lineNumber}: ${error.message}`;
    }
    throw error;
  }
}

const make4k = process.argv.includes("--4k");
const rom = make4k ? memory.slice(0, 0x1000) : memory.slice(0x400, 0xc00);
fs.writeFileSync(output, rom);
console.log(
  `${path.basename(output)}: ${rom.length} bytes, ` +
  `game code ends at $${(highestGameCode - 1).toString(16).padStart(4, "0")}`
);
