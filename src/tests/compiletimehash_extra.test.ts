import { assertEquals } from "@std/assert";
import {
  getCompiletimehash,
  setCompiletimehashOverride,
} from "../constants/compiletimehash.ts";

Deno.test("setCompiletimehashOverride works", () => {
  setCompiletimehashOverride("OVERRIDE");
  assertEquals(getCompiletimehash(), "OVERRIDE");
  setCompiletimehashOverride(null);
});

Deno.test("getCompiletimehash returns env if set", () => {
  Deno.env.set("KPSC_COMPILETIMEHASH", "from-env");
  assertEquals(getCompiletimehash(), "from-env");
  Deno.env.delete("KPSC_COMPILETIMEHASH");
});

Deno.test("getCompiletimehash returns DEV by default", () => {
  setCompiletimehashOverride(null);
  Deno.env.delete("KPSC_COMPILETIMEHASH");
  assertEquals(getCompiletimehash(), "DEV");
});
