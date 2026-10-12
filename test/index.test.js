import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTank, drop, randomDrop, step, analyze, render, renderSVG } from '../src/index.js';
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
test('seeded rain and batch stepping are reproducible', () => {
  const a = createTank({ rain: true }), b = createTank({ rain: true }); step(a, 120); for (let i = 0; i < 120; i++) step(b); assert.deepEqual(a, b); assert.equal(a.drops, 12);
  assert.notDeepEqual(a.current, step(createTank({ rain: true, seed: 8 }), 120).current);
});
test('zero displacement remains zero and centered pulses remain symmetric', () => {
  const t = createTank({ width: 13, height: 13 }); t.current.fill(0); t.previous.fill(0); step(t, 20); assert.equal(analyze(t).maxAmplitude, 0);
  drop(t, 6, 6); step(t, 15);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) assert.ok(Math.abs(t.current[y * 13 + x] - t.current[y * 13 + 12 - x]) < 1e-12);
});
test('boundary cells stay fixed, undamped waves stay finite, and damping dissipates pulses', () => {
  const damped = createTank({ width: 24, height: 16, damping: 0.98 }), initial = analyze(damped).rmsAmplitude; step(damped, 2000);
  assert.ok(analyze(damped).rmsAmplitude < initial * 1e-4);
  const t = createTank({ width: 24, height: 16, damping: 1 }); step(t, 5000); assert.ok(t.current.every(Number.isFinite)); assert.ok(analyze(t).maxAmplitude < 5);
  for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) if (!x || !y || x === t.width - 1 || y === t.height - 1) assert.equal(t.current[y * t.width + x], 0);
});
test('opposite signed pulses cancel and random drops stay inside the tank', () => {
  const t = createTank(); const before = [...t.current]; drop(t, 20, 10, 1); drop(t, 20, 10, -1); for (let i = 0; i < before.length; i++) assert.ok(Math.abs(before[i] - t.current[i]) < 1e-15);
  for (let i = 0; i < 100; i++) randomDrop(t); assert.ok(t.current.every(Number.isFinite)); assert.equal(t.current[0], 0);
});
test('validates input and renders plain frames and portable SVG', () => {
  for (const options of [{ width: 11 }, { seed: -1 }, { damping: 0 }, { damping: 1.1 }, { rain: 1 }]) assert.throws(() => createTank(options));
  const t = createTank({ width: 20, height: 12 }); assert.throws(() => drop(t, 0, 0)); assert.throws(() => drop(t, 5, 5, 10)); assert.throws(() => step(t, 1.5));
  assert.equal(render(t).split('\n').length, 12); assert.ok(render(t).split('\n').every(r => r.length === 20)); assert.equal(render(t).includes('\x1b'), false); assert.match(renderSVG(t), /^<svg/);
});
test('CLI supports reproducible JSON, plain frames, validation, and SVG writes', () => {
  const r = cli(['--rain', '--steps', '100', '--json']); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).frame, 100); assert.equal(r.stdout, cli(['--rain', '--steps', '100', '--json']).stdout);
  assert.equal(cli([]).stdout.includes('\x1b'), false);
  for (const args of [['--seed'], ['--damping', '0'], ['--steps', '-1'], ['--frames', '1', '--json'], ['--wat']]) assert.equal(cli(args).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'waves-')); try { const file = join(dir, 'x.svg'); assert.equal(cli(['--svg', file]).status, 0); assert.match(readFileSync(file, 'utf8'), /WAVE TANK/); assert.equal(cli(['--svg', join(dir, 'missing', 'x.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); }
});
