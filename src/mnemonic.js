// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "./wasm.js";

/**
 *
 * @param {WebAssembly.Exports} wasm
 * @returns {string} Mnemonic string
 */
export function generateRandomMnemonic(wasm) {
  // fill with random values
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  const json = JSON.stringify({
    rng_seed: Array.from(rng_seed),
  });

  return jsonFromBytes(call(wasm, json, wasm.new_mnemonic)).mnemonic_string;
}
/**
 * To get the seed, you need the mnemonic and the passphrase
 * We DO NOT want to store the mnemonic anywhere in storage
 * Pass the seed directly to `new Wallet(wasm, seed)` and don't
 * store it either
 *
 * @param {WebAssembly.Exports} wasm
 * @param {string} mnemonic The string mnemonic
 * @param {string} passphrase The password of the walconst
 * @returns {number[]} seed bytes to be used for the intantiating the wallet instance
 */
export function getSeedFromMnemonic(wasm, mnemonic, passphrase) {
  const json = JSON.stringify({
    mnemonic: mnemonic,
    passphrase: passphrase,
  });

  return jsonFromBytes(call(wasm, json, wasm.get_mnemonic_seed)).mnemonic_seed;
}
