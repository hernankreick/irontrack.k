// Cliente "Supabase" de mentira para la demo: NO tiene red. Cualquier consulta responde con datos vacios y cualquier escritura se
// descarta localmente. Sirve para que App.jsx, que llama a supabase.auth / supabase.from(...) directamente, funcione sin backend.
export function createDemoClient({ coachUserId } = {}) {
  const session = coachUserId ? { user: { id: coachUserId, email: "entrenador@ejemplo.invalid" }, access_token: "demo" } : null;

  function chain(op, payload) {
    const state = { op, payload };
    const result = () => {
      if (state.op === "insert" || state.op === "upsert") return { data: Array.isArray(state.payload) ? state.payload : state.payload ? [state.payload] : [], error: null, count: null };
      if (state.single) return { data: null, error: null, count: null };
      return { data: [], error: null, count: 0 };
    };
    const proxy = new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") return (res, rej) => Promise.resolve(result()).then(res, rej);
        if (prop === "single" || prop === "maybeSingle") return () => { state.single = true; return proxy; };
        return () => proxy;
      },
    });
    return proxy;
  }

  return {
    from() {
      return new Proxy({}, {
        get(_t, prop) {
          if (prop === "insert" || prop === "upsert") return (payload) => chain(prop, payload);
          return () => chain(String(prop));
        },
      });
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session ? session.user : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: null, error: { message: "Demo: el inicio de sesión está deshabilitado." } }),
      signOut: async () => ({ error: null }),
    },
    functions: { invoke: async () => ({ data: null, error: { message: "Demo: sin conexión." } }) },
    channel() { const c = { on: () => c, subscribe: () => c, unsubscribe() {} }; return c; },
    removeChannel() {},
  };
}
