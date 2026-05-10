import { afterEach, describe, expect, it } from "vitest";
import { _resetRateLimitForTests, consumeToken } from "./rate-limit.ts";

afterEach(() => {
  _resetRateLimitForTests();
});

describe("consumeToken", () => {
  it("allows the first 10 requests in the same instant", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(consumeToken("ip-a", now)).toBe(true);
    }
    expect(consumeToken("ip-a", now)).toBe(false);
  });

  it("buckets are per-key", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) consumeToken("ip-a", now);
    expect(consumeToken("ip-a", now)).toBe(false);
    expect(consumeToken("ip-b", now)).toBe(true);
  });

  it("refills smoothly over the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) consumeToken("ip-a", now);
    expect(consumeToken("ip-a", now)).toBe(false);
    // After 6 seconds we should have refilled exactly 1 token (rate = 10/60s).
    expect(consumeToken("ip-a", now + 6_000)).toBe(true);
    expect(consumeToken("ip-a", now + 6_000)).toBe(false);
  });

  it("fully refills after a full window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) consumeToken("ip-a", now);
    // 60 seconds later → bucket fully refilled
    for (let i = 0; i < 10; i++) {
      expect(consumeToken("ip-a", now + 60_000)).toBe(true);
    }
    expect(consumeToken("ip-a", now + 60_000)).toBe(false);
  });
});
