export async function processBatched<T>(
  items: T[],
  batchSize: number,
  handler: (batch: T[]) => Promise<void>,
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: number; errors: Array<{ batchIndex: number; error: string }> }> {
  const errors: Array<{ batchIndex: number; error: string }> = [];
  let succeeded = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      await handler(batch);
      succeeded += batch.length;
    } catch (e: any) {
      errors.push({ batchIndex: Math.floor(i / batchSize), error: e?.message || String(e) });
    }
    onProgress?.(Math.min(i + batchSize, items.length), items.length);
  }
  return { succeeded, errors };
}
