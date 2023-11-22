// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { sync, stakeInfo } from "./node.js";
import { generateRandomMnemonic, getSeedFromMnemonic } from "./mnemonic.js";
import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";
import { getBalance } from "./balance.js";
import { transfer } from "./contracts/transfer.js";
import { stake, unstake, stakeAllow } from "./contracts/stake.js";

// Export mnemnoic functions
export { generateRandomMnemonic, getSeedFromMnemonic };

/**
 * Construct a wallet from this function
 *
 * @param {WebAssembly.Exports} wasmExports The exports of the wallet-core wasm
 * binary https://github.com/dusk-network/wallet-core
 * @param {Uint8Array} seed The seed of the wallet
 * @param {number} gasLimit The gas limit of the wallet, default is 2900000000
 * @param {number} gasPrice The gas price of the wallet, default is 1
 */
export function Wallet(wasmExports, seed, gasLimit = 2900000000, gasPrice = 1) {
  this.wasm = wasmExports;
  this.seed = seed;
  this.gasLimit = gasLimit;
  this.gasPrice = gasPrice;
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
  return await transfer(
    this.wasm,
    this.seed,
    sender,
    reciever,
    amount,
    this.gasLimit,
    this.gasPrice
  );
};
/**
 * Stake Dusk from the provided psk, refund to the same psk
 * @param {string} staker bs58 encoded Psk to stake from
 * @param {number} amount Amount of dusk to stake
 */
Wallet.prototype.stake = async function (staker, amount) {
  const minStake = 1000;
  const index = this.getPsks().indexOf(staker);

  if (amount < minStake) {
    throw new Error(`Stake amount needs to be above a ${minStake} dusk`);
  }

  if (!index) {
    throw new Error("Staker psk not found");
  }

  const stakeAmount = async () => {
    return await stake(
      this.wasm,
      this.seed,
      index,
      staker,
      amount,
      this.gasLimit,
      this.gasPrice
    );
  };

  this.getBalance(staker, async (bal) => {
    if (bal.value < minStake) {
      throw new Error(
        `Balance needs to be greater than min stake amount of ${minStake}`
      );
    } else {
      await stakeAmount();
    }
  });
};
/**
 * Fetches the info of the stake if the person has staked
 * @param {string} psk bs58 encoded Psk of the staker
 * @returns {object} stakeInfoResponse - objec.has_staked, object.eligibility, object.amount, object.reward, object.counter
 */
Wallet.prototype.stakeInfo = async function (psk) {
  const index = this.getPsks().indexOf(psk);

  if (index < 0) {
    throw new Error("Staker psk not found");
  }

  const info = await stakeInfo(this.wasm, this.seed, index);

  if (this.amount) {
    info["amount"] = duskToLux(this.wasm, info.amount);
  }

  return info;
};
/**
 * Unstake dusk from the provided psk, refund to the same psk
 * @param {string} unstaker bs58 encoded psk to unstake from}
 */
Wallet.prototype.unstake = async function (unstaker) {
  const index = this.getPsks().indexOf(unstaker);

  if (!index) {
    throw new Error("psk not found");
  }

  return await unstake(
    this.wasm,
    this.seed,
    index,
    unstaker,
    this.gasLimit,
    this.gasPrice
  );
};

/**
 * Allow staking dusk from the provided psk
 * @param {string} allowStakePsk psk to allow staking from
 * @param {string} senderPsk the psk of the sender, if undefined then index 0 (default index) is used
 */
Wallet.prototype.stakeAllow = async function (allowStakePsk, senderPsk) {
  const psks = this.getPsks();
  const staker = psks.indexOf(allowStakePsk);
  let sender = psks.indexOf(senderPsk);

  if (staker === -1) {
    throw new Error("staker psk not found");
  }

  if (sender === -1) {
    return await stakeAllow(
      this.wasm,
      this.seed,
      staker,
      0,
      this.gasLimit,
      this.gasPrice
    );
  } else {
    return await stakeAllow(
      this.wasm,
      this.seed,
      staker,
      sender,
      this.gasLimit,
      this.gasPrice
    );
  }
};
