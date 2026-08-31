// src/lib/external/paystack.ts
//
// Server-only Paystack integration: the bank list for the business
// onboarding form's bank dropdown, account-number → account-holder-name
// resolution, and checkout payment verification. Used by
// src/app/api/marketplace/paystack/{banks,resolve-account}/route.ts and
// services/marketplace/checkout/{get-checkout-summary,create-orders-for-checkout,confirm-payment-by-reference}.ts (checkout initialize/verify + the
// /api/webhooks/paystack route).
//
// Never import this from a client component — the secret keys below must
// stay server-side; only NEXT_PUBLIC_PAYSTACK_KEY (the publishable key,
// used by the checkout page to open the Paystack popup) is safe in the
// browser, and nothing here needs it.

const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Two secret keys exist in .env on purpose (PAYSTACK_SECRET_KEY is the
// *live* key). Defaulting to the test key everywhere except a real
// production deploy means local development can never accidentally hit
// Paystack's live API — flip NODE_ENV to switch, nothing else to configure.
// Exported so the webhook route (which verifies Paystack's signature
// header via HMAC using this same key) doesn't need its own copy of this
// selection logic.
export function getPaystackSecretKey(): string {
  const key = process.env.NODE_ENV === "production" ? process.env.PAYSTACK_SECRET_KEY : process.env.PAYSTACK_TEST_SECRET_KEY;

  if (!key) {
    throw new Error("Paystack secret key is not configured.");
  }

  return key;
}

async function paystackFetch<T>(
  path: string,
  { cacheSeconds = 0, method = "GET", body: requestBody }: { cacheSeconds?: number; method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      ...(requestBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
    // Payment verification/transfers must never be cached; bank
    // codes/names barely ever change, so listBanks() opts into a day of
    // caching below.
    ...(cacheSeconds > 0 ? { next: { revalidate: cacheSeconds } } : { cache: "no-store" as const }),
  });

  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(body.message || `Paystack request failed (${res.status}).`);
  }

  return body.data as T;
}

export interface PaystackBank {
  name: string;
  code: string;
}

export async function listBanks(): Promise<PaystackBank[]> {
  const banks = await paystackFetch<Array<{ name: string; code: string }>>("/bank?currency=NGN", { cacheSeconds: 60 * 60 * 24 });
  return banks.map(({ name, code }) => ({ name, code }));
}

export interface ResolvedAccount {
  accountNumber: string;
  accountName: string;
}

export async function resolveAccountNumber(accountNumber: string, bankCode: string): Promise<ResolvedAccount> {
  const data = await paystackFetch<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );

  return { accountNumber: data.account_number, accountName: data.account_name };
}

export interface VerifiedTransaction {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amountKobo: number;
}

// Called from both the checkout page's post-payment "verify" call and the
// webhook — never trust the Paystack popup's own client-side success
// callback alone, since that's just the browser's word for it.
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await paystackFetch<{ status: string; reference: string; amount: number }>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );

  return { status: data.status, reference: data.reference, amountKobo: data.amount };
}

// ---------------------------------------------------------------------------
// Seller payouts — services/marketplace/payout/seller-payout.service.ts (called from the seller-payout
// cron, src/app/api/cron/seller-payout/route.ts). Two-step, matching
// Paystack's own Transfers API: create a "recipient" once per business
// (cached as Business.paystackRecipientCode so it's only ever created
// once), then initiate a transfer to that recipient per payout.
// ---------------------------------------------------------------------------

// Creates (once) the Paystack transfer recipient for a business's bank
// account. The resulting recipient_code is cached on
// Business.paystackRecipientCode by the caller so this is never repeated
// for the same business.
export async function createTransferRecipient(params: { accountName: string; accountNumber: string; bankCode: string }): Promise<string> {
  const data = await paystackFetch<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: {
      type: "nuban",
      name: params.accountName,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    },
  });
  return data.recipient_code;
}

export interface InitiatedTransfer {
  transferCode: string;
  status: string;
  reference: string;
}

// Initiates the actual bank transfer. Paystack's own `reference` param
// makes this idempotent on Paystack's side too if the same reference is
// ever retried — services/marketplace/payout/seller-payout.service.ts always passes the OrderItem's id
// (plus a payout-attempt counter) as that reference.
export async function initiateTransfer(params: {
  recipientCode: string;
  amountKobo: number;
  reference: string;
  reason: string;
}): Promise<InitiatedTransfer> {
  const data = await paystackFetch<{ transfer_code: string; status: string; reference: string }>("/transfer", {
    method: "POST",
    body: {
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason,
    },
  });
  return { transferCode: data.transfer_code, status: data.status, reference: data.reference };
}
