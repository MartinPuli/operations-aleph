import { AsyncLocalStorage } from 'node:async_hooks';
import type { ModelRole } from './types.js';

/** A queued writer stops new readers, while an existing decision may finish its
 * nested calls. A swap must not unload weights under a generation, or change
 * the prompt dialect between the rules of the same decision. */
export class RoleCoordinator {
  #readers = 0;
  #writer = false;
  #queue: { write: boolean; enter: () => void }[] = [];

  #drain(): void {
    if (this.#writer) return;
    while (this.#queue.length) {
      const next = this.#queue[0]!;
      if (next.write && this.#readers) return;
      this.#queue.shift();
      if (next.write) this.#writer = true;
      else this.#readers++;
      next.enter();
      if (next.write) return;
    }
  }

  async run<T>(write: boolean, work: () => Promise<T>): Promise<T> {
    await new Promise<void>((enter) => { this.#queue.push({ write, enter }); this.#drain(); });
    try { return await work(); }
    finally {
      if (write) this.#writer = false;
      else this.#readers--;
      this.#drain();
    }
  }
}

const roles = new Map<ModelRole, RoleCoordinator>();
const context = new AsyncLocalStorage<ReadonlySet<ModelRole>>();
function coordinator(role: ModelRole): RoleCoordinator {
  if (!roles.has(role)) roles.set(role, new RoleCoordinator());
  return roles.get(role)!;
}

export function withModelRole<T>(role: ModelRole, work: () => Promise<T>): Promise<T> {
  const held = context.getStore();
  if (held?.has(role)) return work();
  return coordinator(role).run(false, () => context.run(new Set([...(held ?? []), role]), work));
}

export function withRoleChange<T>(role: ModelRole, work: () => Promise<T>): Promise<T> {
  if (context.getStore()?.has(role)) throw new Error('cannot change a model from inside its active request');
  return coordinator(role).run(true, work);
}
