// tests/helpers/fake-providers.ts
//
// Replaces global fetch with in-memory fakes of the two external providers
// the Marketplace talks to. Any other outbound URL throws, so a test can't
// silently reach the network.
//
//   paystack.set(reference, { status: "success", amount: 150000 })   // kobo
//   paystack.fail("timeout" | "http500" | "html" | "garbage")        // next verify calls
//   resend.sent / resend.failNext(n)

type PaystackTxn = { status: string; amount: number; currency?: string; reference?: string };
type FailureMode = "timeout" | "http500" | "html" | "garbage" | null;

export const paystack = {
  transactions: new Map<string, PaystackTxn>(),
  verifyCalls: [] as string[],
  failure: null as FailureMode,
  set(reference: string, txn: PaystackTxn) {
    this.transactions.set(reference, txn);
  },
  fail(mode: FailureMode) {
    this.failure = mode;
  },
  reset() {
    this.transactions.clear();
    this.verifyCalls = [];
    this.failure = null;
  },
};

export const resend = {
  sent: [] as { to: string; subject: string; html: string }[],
  failures: 0,
  failNext(count: number) {
    this.failures = count;
  },
  reset() {
    this.sent = [];
    this.failures = 0;
  },
};

// In-memory Supabase Storage (the REST calls src/lib/storage/supabase-storage.ts makes).
export const storage = {
  objects: new Map<string, Uint8Array>(),
  tokens: new Set<string>(),
  failNextSign: false,
  reset() {
    this.objects.clear();
    this.tokens.clear();
    this.failNextSign = false;
  },
};

// In-memory AI ingestion microservice (services/e-learning/ai-ingest/client.ts), at AI_SERVICE_URL=https://ai.akadverse.test.
export const aiService = {
  requests: [] as { method: string; path: string; auth: string | null; body: unknown }[],
  // Next responses, in order; when empty: POST /ingest -> 202 queued, DELETE -> 204.
  responses: [] as ({ status: number; body?: unknown } | "network")[],
  reset() {
    this.requests = [];
    this.responses = [];
  },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function installFakeProviders() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.startsWith("https://api.paystack.co/transaction/verify/")) {
      const reference = decodeURIComponent(url.split("/verify/")[1]);
      paystack.verifyCalls.push(reference);
      if (paystack.failure === "timeout") {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        throw err;
      }
      if (paystack.failure === "http500") return json({ status: false, message: "Internal error" }, 500);
      if (paystack.failure === "html") return new Response("<html>502 Bad Gateway</html>", { status: 502 });
      if (paystack.failure === "garbage") return json({ status: true, data: { unexpected: true } });
      const txn = paystack.transactions.get(reference);
      if (!txn) return json({ status: false, message: "Transaction reference not found" }, 400);
      return json({ status: true, data: { status: txn.status, amount: txn.amount, currency: txn.currency ?? "NGN", reference: txn.reference ?? reference, paid_at: null } });
    }

    if (url.startsWith("https://api.resend.com/emails")) {
      if (resend.failures > 0) {
        resend.failures -= 1;
        return json({ name: "application_error", message: "Simulated provider outage", statusCode: 500 }, 500);
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      resend.sent.push({ to: Array.isArray(body.to) ? body.to[0] : body.to, subject: body.subject, html: body.html });
      return json({ id: `email_${resend.sent.length}` });
    }

    if (url.startsWith("https://storage.akadverse.test/storage/v1")) {
      const parsed = new URL(url);
      const path = decodeURIComponent(parsed.pathname).replace(/^\/storage\/v1/, "");
      const method = (init?.method ?? "GET").toUpperCase();
      let m: RegExpMatchArray | null;
      if (method === "POST" && (m = path.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/))) {
        if (storage.failNextSign) {
          storage.failNextSign = false;
          return json({ message: "simulated storage outage" }, 500);
        }
        const token = `t${storage.tokens.size + 1}`;
        storage.tokens.add(token);
        return json({ url: `/object/upload/sign/${m[1]}/${m[2]}?token=${token}` });
      }
      if (method === "PUT" && (m = path.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/))) {
        if (!storage.tokens.delete(parsed.searchParams.get("token") ?? "")) return json({ message: "bad token" }, 401);
        const key = `${m[1]}/${m[2]}`;
        // x-upsert: false — an existing object is never overwritten.
        if (storage.objects.has(key)) return json({ message: "The resource already exists" }, 409);
        storage.objects.set(key, new Uint8Array(init?.body as ArrayBuffer));
        return json({ Key: key });
      }
      if (method === "GET" && (m = path.match(/^\/object\/info\/([^/]+)\/(.+)$/))) {
        const o = storage.objects.get(`${m[1]}/${m[2]}`);
        return o ? json({ size: o.byteLength }) : json({ message: "not found" }, 404);
      }
      if (method === "DELETE" && (m = path.match(/^\/object\/([^/]+)$/))) {
        for (const k of JSON.parse(String(init?.body)).prefixes) storage.objects.delete(`${m[1]}/${k}`);
        return json([]);
      }
      if (method === "POST" && (m = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
        return storage.objects.has(`${m[1]}/${m[2]}`) ? json({ signedURL: `/object/sign/${m[1]}/${m[2]}?token=dl` }) : json({ message: "not found" }, 404);
      }
      return json({ message: "no route" }, 404);
    }

    if (url.startsWith("https://ai.akadverse.test/")) {
      const method = (init?.method ?? "GET").toUpperCase();
      const auth = new Headers(init?.headers).get("authorization");
      aiService.requests.push({ method, path: new URL(url).pathname, auth, body: init?.body ? JSON.parse(String(init.body)) : null });
      const next = aiService.responses.shift();
      if (next === "network") throw new TypeError("fetch failed");
      if (next) return next.body === undefined ? new Response(null, { status: next.status }) : json(next.body, next.status);
      return method === "DELETE" ? new Response(null, { status: 204 }) : json({ status: "queued", document_id: JSON.parse(String(init?.body)).document_id }, 202);
    }

    throw new Error(`Unexpected outbound request in tests: ${url}`);
  }) as typeof fetch;
}
