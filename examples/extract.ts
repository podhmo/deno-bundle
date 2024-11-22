import { parseArgs } from "@podhmo/with-help/parse-args";
import { Project } from "@ts-morph/ts-morph";

import { collectImportsFromCode } from "../esbuild-plugin.ts";

const args = parseArgs(Deno.args, {
    string: ["src"],
    required: ["src"],
});

const project = new Project({ useInMemoryFileSystem: true });
let code = Deno.readTextFileSync(args.src);
const imports = collectImportsFromCode(project, code);

// see: https://esm.sh/#tree-shaking
for (const [path, { named, namespace }] of Object.entries(imports)) {
    if (namespace.size > 0) {
        console.error(path)
    } else {
        const replacedPath = `${path}?exports=${Array.from(named).sort().join(",")}`
        console.error(replacedPath);
        code = code.replace(path, replacedPath);
    }
}
console.log(code);
