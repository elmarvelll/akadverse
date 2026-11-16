import { AxiosError } from "axios";
export const state = {
  requests: [] as { method: string; url: string; body: unknown }[],
  alerts: [] as string[], popupAmounts: [] as number[], navigation: [] as string[],
  failProducts: true, failCart: true, staleQuote: true, selected: "early", cartAdded: false,
  show: (_mode: string) => {},
};
export function useSession() { return { data: { user: { name: "Test Student", email: "test@example.test", isAdmin: true } }, status: "authenticated" }; }
export function signOut() { state.navigation.push("sign-out"); }
export function useRouter() { return { push: (href: string) => state.navigation.push(href), replace: (href: string) => state.navigation.push(href), refresh() {} }; }
export function usePathname() { return "/studashboard/marketplace"; }
export function useSearchParams() { return new URLSearchParams(); }
const product = { id: "product", name: "Test charger", price: 3000, secureUrl: null, stock: 5, images: [], variants: [], sides: [], businessId: "business", sellerName: "Test shop", businessType: "BUSINESS", category: "Electronics", description: "USB charger", estimatedDeliveryDate: "Monday", deliveryWindow: "5–6 PM" };
function summary() {
  const deliveryFee = state.selected === "early" ? 700 : 550;
  return {
    items: [{ id: "line", productId: "product", businessId: "business", productName: product.name, sellerName: product.sellerName, price: product.price, quantity: 1, image: null, selectedVariants: null, variantName: null, estimatedDeliveryDate: "Monday", deliveryWindow: "5–6 PM" }],
    location: "Hall A", subtotal: 3000, deliveryFee, serviceFee: 150, total: 3150 + deliveryFee,
    available: true, quoteToken: "quote-" + state.selected,
    businesses: [{ businessId: "business", businessName: "Test shop", selectedSlotId: state.selected, options: [{ slotId: "early", date: "2026-11-23", label: "Early", feeKobo: 70000 }, { slotId: "late", date: "2026-11-23", label: "Late", feeKobo: 55000 }] }],
  };
}
function fail(message: string, status = 503): never {
  const error = new AxiosError(message);
  Object.assign(error, { response: { status, data: { error: message } } });
  throw error;
}
async function request<T>(method: string, url: string, body?: unknown, config?: { params?: { selections?: string } }): Promise<{ data: T; status: number }> {
  state.requests.push({ method, url, body });
  await new Promise(resolve => setTimeout(resolve, 35));
  let data: unknown;
  if (url === "/marketplace/search/products") {
    if (state.failProducts) { state.failProducts = false; fail("Temporary product failure"); }
    data = { products: [product] };
  } else if (url === "/marketplace/products/product") data = { product };
  else if (url === "/marketplace/cart" && method === "POST") {
    if (state.failCart) { state.failCart = false; fail("Stock changed", 409); }
    state.cartAdded = true; data = { item: { id: "line" } };
  } else if (url === "/marketplace/checkout/summary") {
    const choices = JSON.parse(config?.params?.selections ?? "{}");
    if (choices.business) state.selected = choices.business;
    data = summary();
  } else if (url === "/marketplace/checkout/initialize") {
    if (state.staleQuote) { state.staleQuote = false; fail("Checkout pricing changed", 409); }
    data = { reference: "test-reference", amountKobo: Math.round(summary().total * 100), publicKey: "pk_test_fixture", email: "test@example.test", currency: "NGN" };
  } else if (url === "/marketplace/checkout/verify") data = { status: "success" };
  else if (url === "/marketplace/notifications") data = { notifications: [], unreadCount: 0 };
  else if (url === "/marketplace/businesses/featured") data = { businesses: [] };
  else if (url === "/marketplace/vendor/featured") data = { vendors: [] };
  else if (url === "/marketplace/vendor/popular-items") data = { products: [] };
  else if (url === "/marketplace/businesses") data = { businesses: [] };
  else if (url === "/marketplace/cart" || url === "/marketplace/vendor-cart") data = { items: state.cartAdded && url === "/marketplace/cart" ? [{ id: "line", productName: product.name, sellerName: product.sellerName, price: 3000, quantity: 1, stock: 5, image: null }] : [] };
  else throw new Error("Unconfigured browser fixture: " + method + " " + url);
  return { data: data as T, status: 200 };
}
export default {
  get: <T>(url: string, config?: { params?: { selections?: string } }) => request<T>("GET", url, undefined, config),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};
