import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/mod.js"],
  outDir: "./npm",
  typeCheck: false,
  scriptModule: false,
  declaration: false,
  test: false,
  shims: {
    custom: [
      {
        package: {
          name: "dexie",
        },
        globalNames: [
          {
            name: "Dexie",
            exportName: "default",
          },
        ],
      },
    ],
  },
  package: {
    // package.json properties
    name: "@dusk-network/dusk-wallet-js",
    version: Deno.args[0],
    description: "JS library for interacting with the dusk network",
    license: "MPL",
    repository: {
      type: "git",
      url: "git+https://github.com/dusk-network/dusk-wallet-js",
    },
    bugs: {
      url: "https://github.com/dusk-network/dusk-wallet-js/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
