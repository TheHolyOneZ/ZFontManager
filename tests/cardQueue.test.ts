import { test } from "node:test";
import assert from "node:assert/strict";
import { createCardQueue } from "../src/lib/cardQueue.ts";

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("only a few previews load at once, the newest first", async () => {
  const started: string[] = [];
  const pending = new Map<string, ReturnType<typeof deferred>>();
  const q = createCardQueue((id) => {
    started.push(id);
    const d = deferred();
    pending.set(id, d);
    return d.promise;
  }, 2);
  for (const id of ["a", "b", "c", "d"]) q.want(id, () => {});
  assert.deepEqual(started, ["a", "b"]);
  pending.get("a")!.resolve();
  await tick();
  assert.deepEqual(started, ["a", "b", "d"]);
  assert.equal(q.state("a"), "loaded");
  pending.get("b")!.reject(new Error("404"));
  await tick();
  assert.equal(q.state("b"), "failed");
  assert.deepEqual(started, ["a", "b", "d", "c"]);
});

test("cards scrolled away before their turn are never downloaded", async () => {
  const started: string[] = [];
  const q = createCardQueue((id) => {
    started.push(id);
    return new Promise<void>(() => {});
  }, 1);
  q.want("a", () => {});
  const leaveB = q.want("b", () => {});
  const leaveC = q.want("c", () => {});
  leaveB();
  leaveC();
  assert.equal(q.state("b"), undefined);
  assert.deepEqual(started, ["a"]);
});

test("everyone waiting hears once, and finished ones aren't loaded again", async () => {
  let loads = 0;
  const q = createCardQueue(async () => {
    loads++;
  }, 4);
  let heard = 0;
  q.want("x", () => heard++);
  q.want("x", () => heard++);
  await tick();
  assert.equal(heard, 2);
  q.want("x", () => heard++);
  await tick();
  assert.equal(loads, 1);
  assert.equal(heard, 2);
});
