// Doble de Web Locks (navigator.locks) para pruebas: exclusivo, cola FIFO y soporte de AbortSignal (como el real).
// Compartir UNA instancia entre varias "pestanas" simuladas reproduce la exclusion mutua entre contextos del mismo origen.
export function makeFakeLocks() {
  const queue = [];
  let held = false;
  function next() {
    const e = queue.shift();
    if (e) e.run();
  }
  return {
    get held() { return held; },
    request(name, opts, cb) {
      return new Promise((resolve, reject) => {
        const entry = {
          run: async () => {
            held = true;
            try { resolve(await cb({ name })); } catch (e) { reject(e); } finally { held = false; next(); }
          },
        };
        const signal = opts && opts.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const i = queue.indexOf(entry);
            if (i >= 0) { queue.splice(i, 1); const err = new Error("The lock request is aborted"); err.name = "AbortError"; reject(err); }
          });
        }
        if (!held) entry.run(); else queue.push(entry);
      });
    },
  };
}
