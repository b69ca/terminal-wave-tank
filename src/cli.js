#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createTank, step, randomDrop, analyze, render, renderSVG } from './index.js';
import { parse, integer, decimal, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: terminal-wave-tank [--seed N] [--width N] [--height N] [--damping N] [--steps N] [--frames N] [--rain] [--json] [--svg FILE] [--no-color]\nControls: p pause, . step, d random drop, a rain, n seed, r reset, +/- speed, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--seed', '--width', '--height', '--damping', '--steps', '--frames', '--svg'], ['--rain']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const width = integer(options, '--width', live ? Math.max(12, Math.min(90, (process.stdout.columns || 80) - 1)) : 70, 120);
  const height = integer(options, '--height', live ? Math.max(12, Math.min(36, (process.stdout.rows || 32) - 4)) : 34, 120);
  let seed = integer(options, '--seed', 7, 0xffffffff), paused = false, delay = 50;
  const damping = decimal(options, '--damping', 0.995), make = () => createTank({ width, height, seed, damping, rain: !!options['--rain'] }); let tank = make();
  const frames = integer(options, '--frames', live ? Infinity : 1, 100000); step(tank, integer(options, '--steps', 0, 10000));
  if (options['--json'] || options['--svg']) {
    if (options['--frames'] !== undefined) throw new Error('--frames is only for terminal output');
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(tank));
    if (options['--json']) console.log(JSON.stringify(analyze(tank), null, 2));
  } else await terminal({ live, frames, interval: () => delay,
    onKey: key => {
      if (key === 'p' || key === ' ') paused = !paused;
      else if (key === '.') { paused = true; step(tank); }
      else if (key === 'd') randomDrop(tank);
      else if (key === 'a') tank.rain = !tank.rain;
      else if (key === 'n') { seed = (seed + 1) >>> 0; tank = make(); }
      else if (key === 'r') tank = make();
      else if (key === '+' || key === '=') delay = Math.max(10, Math.floor(delay / 2));
      else if (key === '-') delay = Math.min(1000, delay * 2);
    }, onTick: () => { if (paused) return false; step(tank); return true; },
    draw: () => { const r = analyze(tank); return `WAVE TANK | seed ${seed} | frame ${r.frame} | rain ${tank.rain ? 'on' : 'off'}${paused ? ' PAUSED' : ''}\n${render(tank, { color: live && !options['--no-color'] && !process.env.NO_COLOR })}\nRMS ${r.rmsAmplitude.toFixed(4)} | p pause . step d drop a rain r reset q quit`; }
  });
} catch (error) { console.error(`terminal-wave-tank: ${error.message}`); process.exitCode = 2; }
