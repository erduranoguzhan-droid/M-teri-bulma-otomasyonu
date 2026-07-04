/**
 * Eszamanlilik sinirli is havuzu. `items` uzerinde en fazla `limit` gorevi
 * ayni anda calistirir. Her gorev kendi hatasini yakalamalidir (izole);
 * havuz tek bir hatada durmaz. Ilerleme `onDone` ile bildirilir.
 */
export async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  onDone?: (done: number, total: number) => void,
): Promise<void> {
  const total = items.length;
  if (total === 0) return;
  const width = Math.max(1, Math.min(limit, total));
  let next = 0;
  let done = 0;

  async function runner(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= total) return;
      await worker(items[i] as T, i);
      done++;
      onDone?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: width }, () => runner()));
}
