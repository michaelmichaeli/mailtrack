import { describe, it, expect } from "vitest";
import { parseEmail } from "../services/email-parser.service.js";
import { ShopPlatform } from "@mailtrack/shared";

describe("parseEmail", () => {
  it("detects Amazon as merchant from email", () => {
    const html = `
      <html>
        <body>
          <h1>Your Amazon.com order #123-4567890-1234567 has shipped!</h1>
          <table>
            <tr><td class="item-name">Wireless Mouse</td></tr>
          </table>
          <p>Tracking number: 1Z9999999999999999</p>
          <p>Total: $29.99</p>
        </body>
      </html>
    `;
    const result = parseEmail(html, "shipment-tracking@amazon.com", "Your order has shipped!");

    expect(result.merchant).toBe("Amazon");
    expect(result.platform).toBe(ShopPlatform.AMAZON);
    expect(result.trackingNumber).toBe("1Z9999999999999999");
    expect(result.orderId).toBe("123-4567890-1234567");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("detects AliExpress as merchant", () => {
    const html = `
      <html><body>
        <p>Your AliExpress order number: 8012345678901234 has been shipped.</p>
      </body></html>
    `;
    const result = parseEmail(html, "noreply@aliexpress.com", "Your order has shipped");

    expect(result.merchant).toBe("AliExpress");
    expect(result.platform).toBe(ShopPlatform.ALIEXPRESS);
  });

  it("detects eBay as merchant", () => {
    const html = `<html><body><p>eBay order confirmation</p></body></html>`;
    const result = parseEmail(html, "ebay@ebay.com", "Order confirmed");

    expect(result.merchant).toBe("eBay");
    expect(result.platform).toBe(ShopPlatform.EBAY);
  });

  it("extracts price from email", () => {
    const html = `<html><body><p>Total: $49.99</p></body></html>`;
    const result = parseEmail(html, "orders@amazon.com", "Order confirmation");

    expect(result.totalAmount).toBe(49.99);
    expect(result.currency).toBe("USD");
  });

  it("handles unknown merchants gracefully", () => {
    const html = `<html><body><p>Your order has shipped!</p></body></html>`;
    const result = parseEmail(html, "shop@randomstore.com", "Order shipped");

    expect(result.platform).toBe(ShopPlatform.UNKNOWN);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("handles empty/minimal HTML", () => {
    const result = parseEmail("<html><body></body></html>", "", "");
    expect(result.platform).toBe(ShopPlatform.UNKNOWN);
    expect(result.confidence).toBe(0);
  });
});
