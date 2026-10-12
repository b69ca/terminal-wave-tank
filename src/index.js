export function createTank({ width = 70, height = 34, seed = 7, damping = 0.995, rain = false } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 12 && n <= 120)) throw new Error('dimensions must be integers from 12 to 120');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(damping) || damping <= 0 || damping > 1 || typeof rain !== 'boolean') throw new Error('invalid seed, damping, or rain flag');
  const tank = { width, height, seed, damping, rain, alpha: 0.22, frame: 0, drops: 0, randomState: seed, current: new Float64Array(width * height), previous: new Float64Array(width * height) };
  drop(tank, Math.floor(width * 0.35), Math.floor(height * 0.5), 1);
  drop(tank, Math.floor(width * 0.65), Math.floor(height * 0.5), -0.7);
  return tank;
}
export function drop(tank, x, y, amplitude = 1) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y < 1 || x >= tank.width - 1 || y >= tank.height - 1 || !Number.isFinite(amplitude) || Math.abs(amplitude) > 5) throw new Error('drop must be an interior cell with amplitude from -5 to 5');
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 1 || ny < 1 || nx >= tank.width - 1 || ny >= tank.height - 1) continue;
    const id = ny * tank.width + nx, value = amplitude * Math.exp(-(dx * dx + dy * dy) / 2);
    tank.current[id] += value; tank.previous[id] += value;
  }
  tank.drops++; return tank;
}
export function randomDrop(tank) {
  const random = () => { tank.randomState = (Math.imul(tank.randomState, 1664525) + 1013904223) >>> 0; return tank.randomState / 4294967296; };
  return drop(tank, 1 + Math.floor(random() * (tank.width - 2)), 1 + Math.floor(random() * (tank.height - 2)), random() < 0.5 ? -1 : 1);
}
export function step(tank, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('step count must be an integer from 0 to 10000');
  const { width, height } = tank;
  for (let frame = 0; frame < count; frame++) {
    if (tank.rain && tank.frame % 12 === 0) randomDrop(tank);
    const next = new Float64Array(width * height);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const id = y * width + x, u = tank.current[id];
      const laplacian = tank.current[id - 1] + tank.current[id + 1] + tank.current[id - width] + tank.current[id + width] - 4 * u;
      next[id] = u + tank.damping * (u - tank.previous[id]) + tank.alpha * laplacian;
    }
    tank.previous = tank.current; tank.current = next; tank.frame++;
  }
  return tank;
}
export function analyze(tank) {
  let sum = 0, max = 0;
  for (const value of tank.current) { sum += value * value; max = Math.max(max, Math.abs(value)); }
  return { width: tank.width, height: tank.height, seed: tank.seed, frame: tank.frame, damping: tank.damping, rain: tank.rain, drops: tank.drops, rmsAmplitude: Math.sqrt(sum / tank.current.length), maxAmplitude: max };
}
const shades = ' .:-=+*#%@';
export function render(tank, { color = false } = {}) {
  return Array.from({ length: tank.height }, (_, y) => Array.from({ length: tank.width }, (_, x) => {
    const value = tank.current[y * tank.width + x], magnitude = Math.min(1, Math.abs(value) * 5), char = shades[Math.round(magnitude * (shades.length - 1))];
    return color && char !== ' ' ? `\x1b[${value >= 0 ? 33 : 36}m${char}\x1b[0m` : char;
  }).join('')).join('\n');
}
export function renderSVG(tank) {
  const size = 8, w = Math.max(640, tank.width * size + 64), h = tank.height * size + 130;
  const cells = [...tank.current].map((value, id) => { const a = Math.min(1, Math.abs(value) * 5), low = [16, 29, 47], high = value >= 0 ? [255, 209, 102] : [77, 209, 220], c = low.map((n, i) => Math.round(n + (high[i] - n) * a)); return `<rect x="${32 + id % tank.width * size}" y="${86 + Math.floor(id / tank.width) * size}" width="${size}" height="${size}" fill="rgb(${c.join(',')})"/>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(h * 800 / w)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#e8edf8">TERMINAL WAVE TANK</text><text x="32" y="62" font-size="12" fill="#93a4bc">seed ${tank.seed} / frame ${tank.frame} / damping ${tank.damping} / ${tank.drops} drops</text>${cells}<text x="32" y="${h - 16}" font-size="12" fill="#93a4bc">Gold crests / cyan troughs / p pause . step d drop a rain r reset q quit</text></g></svg>\n`;
}
