// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { sync } from "./node.js";
import { generateRandomMnemonic, getSeedFromMnemonic } from "./mnemonic.js";
import { getPsks } from "./keys.js";
import { getBalance } from "./balance.js";
import { transfer } from "./contracts/transfer.js";
import { stake, stakeInfo } from "./contracts/stake.js";

// Export mnemnoic functions
export { generateRandomMnemonic, getSeedFromMnemonic };

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
 * @param {Function} callback - function(balance) {balance.maximum and balance.value}
 *
 */
Wallet.prototype.getBalance = function (psk, callback) {
  getBalance(this.wasm, this.seed, psk, callback);
};
/**
 * Get psks for the seed
 * @returns {Array<string>} psks Psks of the first 21 address for the seed
 */
Wallet.prototype.getPsks = function () {
  return getPsks(this.wasm, this.seed);
};
/**
 * Get psks for the seed
 * @returns {Array<string>} psks Psks of the first 21 address for the seed
 */
Wallet.prototype.sync = async function () {
  return await sync(this.wasm, this.seed);
};
/**
 * Transfer Dusk from sender psk to reciever psk
 * @param {string} sender bs58 encoded Psk to send the dusk from
 * @param {string} reciever bs68 encoded psk of the address who will receiver the dusk
 * @param {number} amount Amount of DUSK to send
 *
 */
Wallet.prototype.transfer = async function (sender, reciever, amount) {
  return await transfer(this.wasm, this.seed, sender, reciever, amount);
};
/**
 * Stake Dusk from the provided psk, refund to the same psk
 * @param {string} staker bs58 encoded Psk to send the dusk from
 * @param {number} amount Amount of dusk to stake
 */
Wallet.prototype.stake = async function (staker, amount) {
  const index = this.getPsks().indexOf(staker);

  if (!index) {
    throw new Error("Staker psk not found");
  }

  return await stake(this.wasm, this.seed, index, staker, amount);
};
/**
 * Fetches the info of the stake if the person has staked
 * @param {string} psk bs58 encoded Psk of the staker
 * @returns {object} stakeInfoResponse - objec.has_staked, object.eligibility, object.amount, object.reward, object.counter
 */
Wallet.prototype.stakeInfo = async function (psk) {
  const index = this.getPsks().indexOf(psk);

  if (!index) {
    throw new Error("Staker psk not found");
  }

  return await stakeInfo(this.wasm, this.seed, index);
};
