import * as esbuild from "esbuild";
import * as jsonc from "@std/jsonc";

export const BASE_URL = "https://esm.sh";

/**
 esbuild plugin for rewriting deno's original import path to esm.sh URL
*/
export async function PathReplacePlugin(
  options: {
    denoConfigPath?: string;
    debug: boolean;
    baseUrl: string;
    developmentMode: boolean;
  } = {
    debug: false,
    baseUrl: BASE_URL,
    developmentMode: false,
  },
) {
  let baseUrl = options.baseUrl ?? BASE_URL;
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // deno.json
  interface Config {
    imports: Record<string, string>;
    specifiers: Record<string, string>;
  }

  // deno.lock
  interface LockConfig {
    specifiers: Record<string, string>;
  }

  const debug = options.debug ? console.error : () => {};

  let config: Config = { imports: {}, specifiers: {} }; // deno.json
  if (options.denoConfigPath) {
    debug(`[DEBUG] load deno.json from ${options.denoConfigPath}`);
    if (options.denoConfigPath.endsWith(".jsonc")) {
      const text = await Deno.readTextFile(options.denoConfigPath);
      config = JSON.parse(JSON.stringify(jsonc.parse(text)));
    } else {
      const text = await Deno.readTextFile(options.denoConfigPath);
      config = JSON.parse(text);
    }

    if (config.imports == undefined) {
      config.imports = {};
    }
    if (config.specifiers == undefined) {
      config.specifiers = {};
    }

    try {
      debug(`[DEBUG] load deno.lock from ${options.denoConfigPath}`);
      const lockConfig: LockConfig = JSON.parse(
        await Deno.readTextFile(
          options.denoConfigPath.replace("deno.json", "deno.lock"),
        ),
      );
      config.specifiers = lockConfig.specifiers;
      if (lockConfig.specifiers !== undefined) {
        for (const [alias, path] of Object.entries(config.imports)) {
          const version = lockConfig.specifiers[path];
          if (version) {
            const parts = path.split("@");
            // e.g. jsr:@std/collections@^1.0.9 ->  jsr:@std/collections@1.0.9 (from deno.lock)
            config.imports[alias] = parts.slice(0, parts.length - 1).join("@") +
              `@${version}`;
            debug(
              `[DEBUG] locked version ${alias} -> ${config.imports[alias]}`,
            );
          }
        }
      }
    } catch (e) {
      debug(`[WARN] no deno.lock found: ${e}`);
    }
  }

  return {
    name: "path-resolve-plugin",
    setup(build: esbuild.PluginBuild) {
      // local deno.json's imports
      for (const [alias, path] of Object.entries(config.imports ?? {})) {
        debug(`[DEBUG] setup resolve ${alias} -> ${path}`);
        const regexp = new RegExp(`^${alias}(/|$)`);
        build.onResolve(
          { filter: regexp },
          (args: esbuild.OnResolveArgs): esbuild.OnResolveResult | null => {
            debug(`[DEBUG] resolve ${args.path} -> ${path}`);
            let replaced = args.path.replace(regexp, path);

            // jsr: -> https://esm.sh/jsr/
            if (replaced.startsWith("jsr:")) {
              replaced = replaced.replace("jsr:", `${baseUrl}/jsr/`);
            }

            // npm: -> https://esm.sh/
            if (replaced.startsWith("npm:")) {
              replaced = replaced.replace("npm:", `${baseUrl}/`);
            }

            if (options.developmentMode) {
              replaced = `${replaced}?dev`; // https://esm.sh/#development-mode
            }
            return { path: replaced, external: true };
          },
        );
      }

      // jsr: -> https://esm.sh/jsr/
      debug(`[DEBUG] setup resolve jsr: -> ${baseUrl}/jsr/`);
      build.onResolve(
        { filter: /^jsr:/ },
        (args: esbuild.OnResolveArgs): esbuild.OnResolveResult | null => {
          debug(`[DEBUG] resolve ${args.path}`);
          let replaced = args.path.replace(/^jsr:/, `${baseUrl}/jsr/`);
          const version = config.specifiers[args.path + "@*"];
          if (version) {
            replaced = `${replaced}@${version}`;
          }
          if (options.developmentMode) {
            replaced = `${replaced}?dev`; // https://esm.sh/#development-mode
          }
          return { external: true, path: replaced };
        },
      );

      // npm: -> https://esm.sh/
      debug(`[DEBUG] setup resolve npm: -> ${baseUrl}/`);
      build.onResolve(
        { filter: /^npm:/ },
        (args: esbuild.OnResolveArgs): esbuild.OnResolveResult | null => {
          debug(`[DEBUG] resolve ${args.path}`);
          let replaced = args.path.replace(/^npm:/, `${baseUrl}/`);
          const version = config.specifiers[args.path + "@*"];
          if (version) {
            replaced = `${replaced}@${version}`;
          }
          if (options.developmentMode) {
            replaced = `${replaced}?dev`; // https://esm.sh/#development-mode
          }
          return { external: true, path: replaced };
        },
      );

      // // TODO: generate html importmap
      // build.onEnd(() => {
      // });
    },
  };
}

/** Utility for transpiling .tsx code to .js (while forwarding external dependencies to esm.sh) */
export async function transpile(
  options: {
    filename: string;
    debug: boolean;
    denoConfigPath?: string;
    baseUrl?: string;
    plugins?: esbuild.Plugin[];
    developmentMode?: boolean;
  },
): Promise<string> {
  let baseUrl = BASE_URL;
  if (options.baseUrl !== undefined) {
    baseUrl = options.baseUrl;
  }
  const developmentMode = options.developmentMode ?? false;

  let plugins = options.plugins;
  if (options.plugins === undefined) {
    plugins = [
      await PathReplacePlugin({ ...options, developmentMode, baseUrl }),
    ];
  }

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
