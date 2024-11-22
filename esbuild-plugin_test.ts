import { collectImportsFromCode } from "./esbuild-plugin.ts";
import { Project } from "jsr:@ts-morph/ts-morph";
import * as assert from "jsr:@std/assert";

Deno.test("extractSymbols", () => {
    const code = `
    import { something } from "./moduleA";
    import * as all from "./moduleB";    
    `;


    const project = new Project({ useInMemoryFileSystem: true });
    const got = collectImportsFromCode(project, code);
    const want = {
        "./moduleA": { named: new Set(["something"]), namespace: new Set<string>() },
        "./moduleB": { named: new Set<string>(), namespace: new Set(["all"]) },
    };
    assert.assertEquals(got, want);
})


