import { generatedVersion } from "./version.ts";

/**
 * Deno Edge Template — orchestras/deno
 *
 * Entry point. Replace this with your application logic.
 */
function main(): void {
  const args = Deno.args;

  if (args.includes("--version") || args.includes("-v")) {
    console.log(generatedVersion);
    Deno.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`orchestras-deno ${generatedVersion}`);
    console.log("");
    console.log("Usage: mod [options]");
    console.log("");
    console.log("Options:");
    console.log("  -v, --version  Print version and exit");
    console.log("  -h, --help     Print this help message");
    Deno.exit(0);
  }

  console.log(`orchestras-deno ${generatedVersion}`);
}

main();
