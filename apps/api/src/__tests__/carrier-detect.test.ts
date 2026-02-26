import { describe, it, expect } from "vitest";
import { detectCarrier, extractTrackingNumbers } from "../lib/carrier-detect.js";
import { Carrier } from "@mailtrack/shared";

describe("detectCarrier", () => {
  it("detects UPS tracking numbers", () => {
    expect(detectCarrier("1Z9999999999999999")).toBe(Carrier.UPS);
    expect(detectCarrier("1ZABC1234567890123")).toBe(Carrier.UPS);
  });

  it("detects USPS tracking numbers", () => {
    expect(detectCarrier("92748999999999999999999")).toBe(Carrier.USPS);
    expect(detectCarrier("9400111899223456789012")).toBe(Carrier.USPS);
  });

  it("detects FedEx tracking numbers", () => {
    expect(detectCarrier("123456789012")).toBe(Carrier.FEDEX);
    expect(detectCarrier("123456789012345")).toBe(Carrier.FEDEX);
  });

  it("detects Royal Mail tracking numbers", () => {
    expect(detectCarrier("AB123456789GB")).toBe(Carrier.ROYAL_MAIL);
  });

  it("returns UNKNOWN for unrecognized formats", () => {
    expect(detectCarrier("ABC123")).toBe(Carrier.UNKNOWN);
  });
});

describe("extractTrackingNumbers", () => {
  it("extracts UPS tracking number from text", () => {
    const text = "Your package 1Z9999999999999999 has been shipped via UPS.";
    const results = extractTrackingNumbers(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].carrier).toBe(Carrier.UPS);
    expect(results[0].trackingNumber).toBe("1Z9999999999999999");
  });

  it("extracts multiple tracking numbers", () => {
    const text = "Package 1: 1Z1234567890123456 (UPS), Package 2: AB123456789GB (Royal Mail)";
    const results = extractTrackingNumbers(text);
    expect(results.length).toBe(2);
  });

  it("returns empty array for text without tracking numbers", () => {
    const text = "Thank you for your order! We will email you when it ships.";
    const results = extractTrackingNumbers(text);
    expect(results.length).toBe(0);
  });
});
