import { assertEquals } from "@std/assert";
import { formatHHMMSS } from "../commands/status.ts";

Deno.test("formatHHMMSS pads correctly", () => {
  assertEquals(formatHHMMSS(0), "00:00:00");
  assertEquals(formatHHMMSS(59), "00:00:59");
  assertEquals(formatHHMMSS(3600), "01:00:00");
  assertEquals(formatHHMMSS(28_800), "08:00:00");
  assertEquals(formatHHMMSS(-5), "00:00:00");
});
