// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { sync } from "./node.js";
import { generateRandomMnemonic, getSeedFromMnemonic } from "./mnemonic.js";
import { getPsks } from "./keys.js";
import { getBalance } from "./balance.js";
import { getUnpsentNotes } from "./indexedDB.js";

/**
 * Construct a wallet from this function
 *
 * @param {WebAssembly.Exports} wasmExports The exports of the wallet-core wasm
 * binary https://github.com/dusk-network/wallet-core
 * @param {Uint8Array} seed The seed of the wallet
 */
export function Wallet(wasmExports, seed) {
  this.wasm = wasmExports;
  this.seed = seed;
}
/**
 * Get balance
 * @param {string} psk - bs58 encoded public spend key of the user we want to
 * @param {Function} callback - function(balance) {}
 * find the balance of
 */
Wallet.prototype.getBalance = function (psk, callback) {
  getBalance(this.wasm, this.seed, psk, callback);
};
/**
 * Get psks for the seed
 * @returns {Array<string>} psks Psks of the first 21 address for the seed
 */
Wallet.prototype.getPsks = function (k) {
  return getPsks(this.wasm, this.seed);
};
/**
 * Get psks for the seed
 * @returns {Array<string>} psks Psks of the first 21 address for the seed
 */
Wallet.prototype.sync = async function () {
  return await sync(this.wasm, this.seed);
};
