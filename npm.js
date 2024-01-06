import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./npm");

const wasm = await Deno.readFile(
  "../../Rust/wallet-core/pkg/dusk_wallet_core_bg.wasm"
);
const string = `let wasm = new Uint8Array([${wasm.join(
  ","
)}]);let __wbg_star0 = {};`;
const jsFile = await Deno.open(
  "../../Rust/wallet-core/pkg/dusk_wallet_core.js"
);
const lines = jsFile.readable.getReader();

const decoder = new TextDecoder();

let done = false;
let str = "";

do {
  const result = await lines.read();
  done = result.done;

  if (result.value) {
    str = str + decoder.decode(result.value);
  }
} while (!done);

str = str.slice(46);
str = string + str;

await Deno.writeTextFile("./pkg/dusk_wallet_core.js", str);

await build({
  entryPoints: ["./src/mod.js"],
  outDir: "./npm",
  typeCheck: false,
  declaration: false,
  test: false,
  mappings: {
    "npm:fake-indexeddb": {
      name: "fake-indexeddb",
      version: "5.0.1",
    },
    "https://unpkg.com/dexie/dist/dexie.mjs": {
      name: "dexie",
      version: "3.2.4",
    },
  },
  shims: [],
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
