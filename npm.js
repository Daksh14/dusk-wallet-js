import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./npm");

const wasm = await Deno.readFile(
  "../../Rust/wallet-core/pkg/dusk_wallet_core_bg.wasm"
);
const string = `let wasm = new Uint8Array([${wasm.join(
  ","
)}]);function initSync(){return wasm};export { initSync }`;
const jsFile = await Deno.open(
  "../../Rust/wallet-core/pkg/dusk_wallet_core.js"
);

await Deno.writeTextFile("./pkg/dusk_wallet_core.js", string);

// get the most recent git tag
const cmd = new Deno.Command("git", {
  args: ["describe", "--tags", "--abbrev=0"],
});

const cmdDirty = new Deno.Command("git", {
  args: [
    "ls-files",
    "--deleted",
    "--modified",
    "--others",
    "--exclude-standard",
    "--",
    ":/",
  ],
});

const gitTag = await cmd.output();
const codeDirty = await cmdDirty.output();

if (!gitTag.success) {
  throw new Error("Cannot get git tag");
}

if (!codeDirty.success) {
  throw new Error("Cannot check if git repo is dirty");
}

let tag = new TextDecoder().decode(gitTag.stdout).replace("\n", "");

if (tag === "") {
  throw new Error("No git tag found");
}

if (Deno.args.length > 0) {
  console.log("Using version from command line");

  if (Deno.args[0] === tag) {
    throw new Error(
      "Version from command line is not the same as the latest git tag, create a new git tag"
    );
  }

  tag = Deno.args[0];
}

const isDirty = new TextDecoder().decode(codeDirty.stdout);

if (isDirty !== "") {
  throw new Error("Git repo is dirty, commit changes before building");
}

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
    version: tag,
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
