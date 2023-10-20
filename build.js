// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import * as esbuild from "https://deno.land/x/esbuild@v0.19.4/mod.js";
import { load } from "https://deno.land/std@0.204.0/dotenv/mod.ts";
import { cache } from "https://deno.land/x/esbuild_plugin_cache@v0.2.10/mod.ts";

const importMap = { imports: {} };
const env = await load({ export: true });

let envVariables = {};

for (const [key, value] of Object.entries(env)) {
  // That's how esbuild likes it
  envVariables["process.env." + key] = `"${String(value)}"`;
}

console.log("Bundling..");

esbuild
  .build({
    entryPoints: ["src/mod.js"],
    bundle: true,
    format: "esm",
    outfile: "dist/wallet.js",
    plugins: [cache({ importMap, directory: "./cache" })],
    define: envVariables,
  })
  .then(() => {
    console.log("Bundling Completed");
    esbuild.stop();
  })
  .catch((e) => console.log("Error occured while bundling library: " + e));
