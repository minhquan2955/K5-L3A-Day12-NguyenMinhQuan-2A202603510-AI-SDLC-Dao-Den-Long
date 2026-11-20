const polar = (x, z, radius, count, first = 0, step = 360 / count, y = 0) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (first + i * step) * Math.PI / 180;
    return [x + radius * Math.cos(angle), y, z + radius * Math.sin(angle)];
  });
const island = (x, r) => ({ x, z: 0, r, y: 0 });
const pad = (x, y, z, vy, speed, dx, dz) => {
  const length = Math.hypot(dx, dz);
  return { pos: [x, y, z], vy, speed, direction: [dx / length, dz / length] };
};
const spawn = [0, 0, 0];

export const maps = {
  1: {
    name: 'Đảo Bến', spawn, circles: [island(0, 40)], ramps: [], pads: [],
    lanternPositions: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...polar(0, 0, 12, 8), ...polar(0, 0, 33, 16)],
    shadePoints: polar(0, 0, 37, 12, 15), mistPoints: [],
    shadeInterval: 480, shadeCap: 6, charmPoints: [],
  },
  2: {
    name: 'Đảo Cau', spawn, circles: [island(0, 28), island(70, 28)], bridge: true, ramps: [],
    pads: [pad(20, 0, 18, 14, 24, 50, -18), pad(50, 0, -18, 14, 24, -50, 18)],
    lanternPositions: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [0, 70].flatMap(x => [...polar(x, 0, 10, 4), ...polar(x, 0, 22, 8)]),
    shadePoints: [0, 70].flatMap(x => polar(x, 0, 26, 8, 22.5)),
    mistPoints: [0, 70].flatMap(x => polar(x, 0, 23, 4, 45)),
    shadeInterval: 420, shadeCap: 8, charmPoints: [[35, 0, 0]],
  },
  3: {
    name: 'Đảo Chuông', spawn: [0, 0, -10], circles: [island(0, 45)], tiers: true,
    ramps: [{ angle: Math.PI / 6 }, { angle: 5 * Math.PI / 6 }],
    pads: [pad(0, 3, 13, 12, 8, 0, -1)],
    lanternPositions: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10],
      [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...polar(0, 0, 34, 18), ...polar(0, 0, 18, 8, 20, 20, 3),
      ...polar(0, 0, 5, 4, 45, 90, 6)],
    shadePoints: polar(0, 0, 43, 16), mistPoints: polar(0, 0, 38, 8, 22.5),
    shadeInterval: 360, shadeCap: 10, charmPoints: [[30, 0, 25], [-30, 0, 25]],
  },
};

const EPSILON = 1e-8;

export function rampHeight(map, x, z) {
  for (const { angle } of map.ramps) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const across = z * c - x * s;
    const along = x * c + z * s;
    if (Math.abs(across) <= 1.5 + EPSILON && along >= 24 - EPSILON && along <= 30 + EPSILON) {
      return Math.max(0, Math.min(3, (30 - along) / 2));
    }
  }
  return null;
}

export function groundBelow(map, x, z, y = Infinity) {
  let height = null;
  if (y >= -EPSILON && (map.circles.some(c => Math.hypot(x - c.x, z - c.z) <= c.r + EPSILON) ||
      (map.bridge && x >= 26 && x <= 44 && Math.abs(z) <= 2))) height = 0;
  if (!map.tiers) return height;
  const radius = Math.hypot(x, z);
  if (y >= 3 - EPSILON && z > 0 && radius >= 12 - EPSILON && radius <= 24 + EPSILON) height = 3;
  if (y >= 6 - EPSILON && radius <= 8 + EPSILON) height = 6;
  const ramp = rampHeight(map, x, z);
  if (ramp !== null && y >= ramp - EPSILON) height = Math.max(height ?? 0, ramp);
  return height;
}

export function blockedAt(map, x, z, y) {
  return Boolean(map.tiers && y >= 6 - EPSILON && y < 14 && Math.hypot(x, z) < 2);
}
