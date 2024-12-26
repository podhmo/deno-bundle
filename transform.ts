import * as esbuild from "esbuild";
import { ESM_SH_BASE_URL, PathReplacePlugin } from "./_esbuild.ts";

export async function transform(
  options: {
    filename: string;
    debug: boolean;
    denoConfigPath?: string;
    baseUrl?: string;
  },
): Promise<string> {
  let baseUrl = ESM_SH_BASE_URL;
  if (options.baseUrl !== undefined) {
    baseUrl = options.baseUrl;
  }

  const plugins: esbuild.Plugin[] = [
    await PathReplacePlugin({ ...options, baseUrl }),
  ];
  const b: esbuild.BuildResult = await esbuild.build({
    // inject, alias
    entryPoints: [options.filename],
    plugins: plugins,
    write: false,
    color: true,
    bundle: true, // need for resolve import
    logLevel: options.debug ? "debug" : "info",
    format: "esm",
  });
  if (b.outputFiles === undefined) {
    if (b.errors.length > 0) {
      throw new Error(b.errors[0].text);
    }
    throw new Error("no outputFiles");
  }
  return b.outputFiles[0].text;
}
