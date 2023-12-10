// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "../wasm.js";
import { luxToDusk } from "../crypto.js";
import { request, stakeInfo } from "../node.js";
import { execute } from "../execute.js";
import { getPsks } from "../keys.js";

/**
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} sender_index Index of the staker
 * @param {string} refund Where to refund this transaction to
 * @param {number} amount amount to stake
 * @param {number} gasLimit gas limit
 * @param {number} gasPrice gas price
 *
 * @returns {Promise} Promise object which resolves after the tx gets accepted into the blockchain
 */
export async function stake(
  wasm,
  seed,
  senderIndex,
  refund,
  amount,
  gasLimit,
  gasPrice
) {
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  // convert the amount from lux to dusk
  amount = luxToDusk(wasm, amount);

  const info = await stakeInfo(wasm, seed, senderIndex);

  if (info.has_staked) {
    throw new Error("Cannot stake if already staked");
  }

  if (!info.has_key) {
    throw new Error("No stake exists for this key");
  }

  let counter = 0;

  if (info.counter) {
    counter = info.counter;
  }

  const args = JSON.stringify({
    rng_seed: Array.from(rng_seed),
    seed: seed,
    refund: refund,
    value: amount,
    sender_index: senderIndex,
    gas_limit: gasLimit,
    gas_price: gasPrice,
  });

  const stctProofArgs = jsonFromBytes(call(wasm, args, wasm.get_stct_proof));

  const stctProofBytes = stctProofArgs.bytes;
  const crossover = stctProofArgs.crossover;
  const blinder = stctProofArgs.blinder;
  const fee = stctProofArgs.fee;

  const stctProofReq = await request(
    stctProofBytes,
    "prove_stct",
    false,
    undefined,
    "rusk",
    "2"
  );

  const bufferStctProofReq = await stctProofReq.arrayBuffer();

  console.log(
    "stct proof request response length: " + bufferStctProofReq.byteLength
  );

  const callDataArgs = JSON.stringify({
    staker_index: senderIndex,
    seed: seed,
    spend_proof: Array.from(new Uint8Array(bufferStctProofReq)),
    value: amount,
    counter: counter,
  });

  const stakeCallData = jsonFromBytes(
    call(wasm, callDataArgs, wasm.get_stake_call_data)
  );

  const contract = stakeCallData.contract;
  const method = stakeCallData.method;
  const payload = stakeCallData.payload;

  const callData = {
    contract: contract,
    method: method,
    payload: payload,
  };

  const crossoverType = {
    crossover: crossover,
    blinder: blinder,
    value: amount,
  };

  return execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    fee,
    gasLimit,
    gasPrice
  );
}

/**
 * Unstake
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} sender_index Index of the psk to unstake
 * @param {string} refund psk to refund this tx to
 * @param {number} gasLimit gas limit
 * @param {number} gasPrice gas price
 *
 * @returns {Promise} Promise object which resolves after the tx gets accepted into the blockchain
 */
export async function unstake(
  wasm,
  seed,
  sender_index,
  refund,
  gasLimit,
  gasPrice
) {
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  const info = await stakeInfo(wasm, seed, sender_index);

  if (!info.has_staked || info.amount === undefined) {
    throw new Error("Cannot unstake if there's no stake");
  }

  let counter = 0;

  if (info.counter) {
    counter = info.counter;
  }

  const value = info.amount;

  const args = JSON.stringify({
    rng_seed: Array.from(rng_seed),
    seed: seed,
    refund: refund,
    value: value,
    sender_index: sender_index,
    gas_limit: gasLimit,
    gas_price: gasPrice,
  });

  const wfctProofArgs = jsonFromBytes(call(wasm, args, wasm.get_wfct_proof));
  const wfctProofBytes = wfctProofArgs.bytes;
  const crossover = wfctProofArgs.crossover;
  const blinder = wfctProofArgs.blinder;
  const fee = wfctProofArgs.fee;
  const unstakeNote = wfctProofArgs.unstake_note;

  const wfctProofReq = await request(
    wfctProofBytes,
    "prove_wfct",
    false,
    undefined,
    "rusk",
    "2"
  );

  const bufferWfctProofReq = await wfctProofReq.arrayBuffer();

  console.log(
    "wfct proof request response length: " + bufferWfctProofReq.byteLength
  );

  const callDataArgs = JSON.stringify({
    sender_index: sender_index,
    seed: seed,
    unstake_proof: Array.from(new Uint8Array(bufferWfctProofReq)),
    unstake_note: unstakeNote,
    counter: counter,
  });

  const unstakeCallData = jsonFromBytes(
    call(wasm, callDataArgs, wasm.get_unstake_call_data)
  );

  const contract = unstakeCallData.contract;
  const method = unstakeCallData.method;
  const payload = unstakeCallData.payload;

  const callData = {
    contract: contract,
    method: method,
    payload: payload,
  };

  const crossoverType = {
    crossover: crossover,
    blinder: blinder,
    value: 0,
  };

  return execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    fee,
    gasLimit,
    gasPrice
  );
}

/**
 * Allow a staker psk to stake
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} staker_index Index of the staker
 * @param {number} sender_index Index of the sender, if undefined we use the default one
 * @param {number} gasLimit gas limit
 * @param {number} gasPrice gas price
 *
 * @returns {Promise} Promise object which resolves after the tx gets accepted into the blockchain
 */
export async function stakeAllow(
  wasm,
  seed,
  staker_index,
  sender_index,
  gasLimit,
  gasPrice
) {
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  const senderStakeinfo = await stakeInfo(wasm, seed, sender_index);
  const stakerStakeInfo = await stakeInfo(wasm, seed, staker_index);

  const refund = getPsks(wasm, seed)[sender_index];

  let counter = 0;

  if (stakerStakeInfo.has_key) {
    throw new Error("staker_index is already allowed to stake");
  }

  if (senderStakeinfo.counter) {
    counter = senderStakeinfo.counter;
  }

  const args = JSON.stringify({
    rng_seed: Array.from(rng_seed),
    seed: seed,
    refund: refund,
    sender_index: sender_index,
    owner_index: staker_index,
    counter: counter,
    gas_limit: gasLimit,
    gas_price: gasPrice,
  });

  const allowCallData = jsonFromBytes(
    call(wasm, args, wasm.get_allow_call_data)
  );

  const callData = {
    contract: allowCallData.contract,
    method: allowCallData.method,
    payload: allowCallData.payload,
  };

  const crossoverType = {
    crossover: allowCallData.crossover,
    blinder: allowCallData.blinder,
    value: 0,
  };

  return execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    allowCallData.fee,
    gasLimit,
    gasPrice
  );
}

/**
 * Allow a staker psk to stake
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} staker_index the index of the staker who wants to withdraw the reward
 * @param {number} gasLimit gas limit
 * @param {number} gasPrice gas price
 *
 * @returns {Promise} Promise object which resolves after the tx gets accepted into the blockchain
 */
export async function withdrawReward(
  wasm,
  seed,
  staker_index,
  gasLimit,
  gasPrice
) {
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  const info = await stakeInfo(wasm, seed, staker_index);

  const refund = getPsks(wasm, seed)[staker_index];

  // check if reward exists
  if (!info.has_staked || info.reward <= 0) {
    throw new Error(
      "No reward to withdraw, take part in concensus to recieve reward"
    );
  }
  let counter = 0;

  if (info.counter) {
    counter = info.counter;
  }

  const args = JSON.stringify({
    rng_seed: Array.from(rng_seed),
    seed: seed,
    refund: refund,
    sender_index: staker_index,
    owner_index: staker_index,
    counter: counter,
    gas_limit: gasLimit,
    gas_price: gasPrice,
  });

  const withdrawCallData = jsonFromBytes(
    call(wasm, args, wasm.get_withdraw_call_data)
  );

  const callData = {
    contract: withdrawCallData.contract,
    method: withdrawCallData.method,
    payload: withdrawCallData.payload,
  };

  const crossoverType = {
    crossover: withdrawCallData.crossover,
    blinder: withdrawCallData.blinder,
    value: 0,
  };

  return execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    withdrawCallData.fee,
    gasLimit,
    gasPrice
  );
}
