// Outside a request there are no headers/cookies — mirrors Next's behaviour for jobs.
export async function headers(): Promise<Headers> {
  throw new Error("headers() called outside a request");
}
export async function cookies() {
  const store = new Map<string, string>();
  return {
    get: (k: string) => (store.has(k) ? { name: k, value: store.get(k)! } : undefined),
    set: (k: string, v: string) => void store.set(k, v),
    delete: (k: string) => void store.delete(k),
  };
}
