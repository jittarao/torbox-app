/**
 * Run async work for each item with at most `concurrency` tasks in flight.
 * Unlike fixed-size Promise.all batches, a slot frees as soon as one task finishes.
 *
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<void>} fn
 */
export async function runWithConcurrency(items, concurrency, fn) {
  if (!items.length) return;

  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await fn(items[index], index);
    }
  });

  await Promise.all(workers);
}
