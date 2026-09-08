// .../vendor-checkout/summary/route.ts
//
// GET -> the Vendor checkout page's preview (cart, fees, slot
// availability). Thin route — see ./route.controller.ts.

import { getVendorCheckoutSummary } from "./route.controller";

export async function GET() {
  return getVendorCheckoutSummary();
}
