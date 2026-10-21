type ChainCall = [method: string, ...args: unknown[]];

export interface QueryChain {
  /** Every builder method called on this chain, in order, e.g. ["values", {...}]. */
  calls: ChainCall[];
}

function makeChain(settle: () => Promise<unknown>): QueryChain {
  const calls: ChainCall[] = [];
  const chain: QueryChain = new Proxy({ calls }, {
    get(target, prop) {
      if (prop === "calls") return target.calls;
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
          settle().then(onFulfilled, onRejected);
      }
      return (...args: unknown[]) => {
        calls.push([String(prop), ...args]);
        return chain;
      };
    },
  });
  return chain;
}

/** A drizzle-like query builder: any method returns the chain, and awaiting it resolves to `rows`. */
export function queryChain(rows: unknown): QueryChain {
  return makeChain(() => Promise.resolve(rows));
}

/** Like queryChain, but awaiting it rejects with `error`. */
export function failingChain(error: unknown): QueryChain {
  return makeChain(() => Promise.reject(error));
}

/** The arguments passed to the first `method` call on a chain. */
export function argsOf(chain: QueryChain, method: string): unknown[] | undefined {
  return chain.calls.find(([name]) => name === method)?.slice(1);
}
