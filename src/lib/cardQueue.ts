export type CardState = "queued" | "loading" | "loaded" | "failed";

export interface CardQueue {
  want: (id: string, done: () => void) => () => void;
  state: (id: string) => CardState | undefined;
}

export function createCardQueue(load: (id: string) => Promise<void>, max: number): CardQueue {
  const states = new Map<string, CardState>();
  const waiters = new Map<string, Set<() => void>>();
  const queue: string[] = [];
  let running = 0;

  const pump = () => {
    while (running < max && queue.length > 0) {
      const id = queue.pop() as string;
      running++;
      states.set(id, "loading");
      load(id)
        .then(
          () => states.set(id, "loaded"),
          () => states.set(id, "failed"),
        )
        .finally(() => {
          running--;
          waiters.get(id)?.forEach((fn) => fn());
          waiters.delete(id);
          pump();
        });
    }
  };

  return {
    state: (id) => states.get(id),
    want: (id, done) => {
      const current = states.get(id);
      if (current === "loaded" || current === "failed") return () => {};
      const set = waiters.get(id) ?? new Set();
      set.add(done);
      waiters.set(id, set);
      if (!current) {
        states.set(id, "queued");
        queue.push(id);
        pump();
      }
      return () => {
        set.delete(done);
        if (set.size > 0 || states.get(id) !== "queued") return;
        waiters.delete(id);
        states.delete(id);
        const at = queue.indexOf(id);
        if (at >= 0) queue.splice(at, 1);
      };
    },
  };
}
