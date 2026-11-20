export function summarizeFrames(frames) {
  if (!frames.length) return null;
  const slowest = [...frames].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(frames.length * .01)));
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    frames: frames.length,
    avg_fps: 1000 * frames.length / frames.reduce((sum, dt) => sum + dt, 0),
    p1_low_fps: 1000 / (slowest.reduce((sum, dt) => sum + dt, 0) / slowest.length),
    frame_ms_p95: sorted[Math.ceil(sorted.length * .95) - 1],
  };
}
