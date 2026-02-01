/**
 * Creates a concurrency limiter (semaphore) for async operations.
 * Ensures at most `max` operations run simultaneously; excess tasks queue up.
 */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            if (queue.length) queue.shift()!();
          });
      };
      active < max ? run() : queue.push(run);
    });
}
