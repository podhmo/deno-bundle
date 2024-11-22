import { extractImportedSymbolsFromCode } from "./esbuild-plugin.ts";
import { Project } from "jsr:@ts-morph/ts-morph";
import * as assert from "jsr:@std/assert";

Deno.test("extractSymbols", () => {
    const code = `
    import { something } from "./moduleA";
    import * as all from "./moduleB";
    `;


    const project = new Project({ useInMemoryFileSystem: true });
    const got = extractImportedSymbolsFromCode(project, code);
    const want = { "./moduleA": ["something"] };
    assert.assertEquals(got, want);
})


