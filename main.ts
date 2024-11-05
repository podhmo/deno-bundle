import { transpile } from "@deno/emit";
import { parseArgs, buildUsage } from "@podhmo/with-help";
import { join as pathjoin, dirname, basename } from "jsr:@std/path"

async function main(args: string[]) {
  const options = parseArgs(args, {
    name: "transpile",
    usageText: `${buildUsage({ name: "transpile" })} <filename>...`,
    description: "transpile typescript file (deno/emit wrapper)",
    string: ["dst"],
  } as const);

  // TODO: concurrency
  for (const filename of options._) {
    const url = new URL(filename, import.meta.url);
    const resultMap = await transpile(url, {});
    if (options.dst !== undefined) {
      for (const [filename, code] of resultMap.entries()) {
        // write to file
        const writename = pathjoin(options.dst, basename(filename).replace(/\.tsx?$/, ".js"));
        await Deno.mkdir(dirname(writename), { recursive: true });

        console.log(`write to ${writename}`);
        await Deno.writeTextFile(writename, code);
      }
    } else {
      // write to stdout
      for (const [filename, code] of resultMap.entries()) {
        console.log(`// ---- ${filename} ----`);
        console.log(code);
      }
    }
  }
}

if (import.meta.main) {
  await main(Deno.args);
}