import "../helpers/env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import BusinessDeliveries from "@/app/studashboard/admin/marketplace/deliveries/businesses/page";
import VendorDeliveries from "@/app/studashboard/admin/marketplace/deliveries/vendors/page";
import DeliveryRosterManager from "@/app/studashboard/admin/marketplace/delivery-roster/_components/DeliveryRosterManager";

describe("central admin delivery management", () => {
  it("provides Business configuration, schedule, overflow and scoped assignment controls", () => {
    const html = renderToStaticMarkup(<BusinessDeliveries />);
    for (const label of ["Business deliveries", "Roster &amp; configuration", "Delivery schedule", "Overflow management", "/studashboard/admin/marketplace/deliveries/businesses/assign", "three calendar days", "round-robin"]) assert.ok(html.includes(label), label);
    assert.ok(!html.includes('aria-label="Delivery operation"'), "operation is fixed in the Business section");
  });
  it("keeps vendor tools and customer-selected booking independent", () => {
    const html = renderToStaticMarkup(<VendorDeliveries />);
    for (const label of ["Vendor deliveries", "Time ranges &amp; date roster", "Monitoring &amp; status", "Customers pick a delivery date"]) assert.ok(html.includes(label), label);
    assert.ok(!html.includes("three calendar days"));
    assert.ok(!html.includes('aria-label="Delivery operation"'));
  });
  it("retains the legacy roster operation selector", () => {
    const html = renderToStaticMarkup(<DeliveryRosterManager />);
    assert.ok(html.includes('aria-label="Delivery operation"'));
    assert.ok(html.includes('role="radio"'));
  });
});
