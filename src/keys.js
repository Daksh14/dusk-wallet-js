// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "./wasm.js";

/**
 * Get the public spend keys in order from 1 to 24 for the seed
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed Seed of the wallet
 * @returns {Array<string>} psks base58 encoded public spend keys
 */
export function getPsks(wasm, seed) {
  let json = JSON.stringify({
    seed: Array.from(seed),
  });

  return jsonFromBytes(call(wasm, json, wasm.public_spend_keys)).keys;
}
