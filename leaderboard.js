const NAME = /^[A-Za-z0-9_]{3,12}$/;

export const validName = name => typeof name === 'string' && NAME.test(name);

export function rankEntries(entries) {
  return entries.filter(entry => validName(entry.name) && Number.isSafeInteger(entry.score) && entry.score >= 0 &&
    Number.isInteger(entry.nights_won) && entry.nights_won >= 0 && entry.nights_won <= 3 &&
    Number.isFinite(Date.parse(entry.achieved_at)) && Number.isSafeInteger(entry.seed))
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at))
    .slice(0, 10);
}

export function addEntry(entries, candidate, now = new Date()) {
  if (!validName(candidate.name)) return { error: 'invalid_name' };
  if (!Number.isSafeInteger(candidate.score) || candidate.score < 0 || !Number.isInteger(candidate.nights_won) ||
      candidate.nights_won < 0 || candidate.nights_won > 3 || !Number.isSafeInteger(candidate.seed)) {
    return { error: 'invalid_entry' };
  }
  const entry = { name: candidate.name, score: candidate.score, nights_won: candidate.nights_won,
    achieved_at: now.toISOString(), seed: candidate.seed };
  return { entry, entries: rankEntries([...entries, entry]) };
}
