export function generateAccessKey(year: number, existingKeys: string[]): string {
  const prefix = String(year);
  const suffixes = existingKeys
    .filter(k => k.startsWith(prefix) && k.length === 7)
    .map(k => parseInt(k.slice(4), 10))
    .filter(n => !isNaN(n));
  const next = (suffixes.length > 0 ? Math.max(...suffixes) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export function generateBatchAccessKeys(year: number, existingKeys: string[], count: number): string[] {
  const keys: string[] = [];
  const running = [...existingKeys];
  for (let i = 0; i < count; i++) {
    const k = generateAccessKey(year, running);
    keys.push(k);
    running.push(k);
  }
  return keys;
}
