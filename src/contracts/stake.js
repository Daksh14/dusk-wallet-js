// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "../wasm.js";
import { luxToDusk, duskToLux } from "../crypto.js";
import { request } from "../node.js";
import { execute } from "../execute.js";
import { getPsks, getPublicKeyRkyvSerialized } from "../keys.js";

/**
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} sender_index Index of the staker
 * @param {string} refund Where to refund this transaction to
 * @param {number} amount amount to stake
 */
export async function stake(wasm, seed, sender_index, refund, amount) {
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  // convert the amount from lux to dusk
  amount = luxToDusk(wasm, amount);

  const info = await stakeInfo(wasm, seed, sender_index);

  if (info.has_staked) {
    throw new Error("Cannot stake if already staked");
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
    sender_index: sender_index,
    gas_limit: 2900000000,
    gas_price: 1,
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
    staker_index: sender_index,
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

  execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    fee,
    2900000000,
    1
  );
}

/**
 * Fetch the stake info from the network
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} psk
 * @returns {object} - object.has_staked, object.eligibility, object.amount, object.reward, object.counter, object.epoch
 */
export async function stakeInfo(wasm, seed, index) {
  const pk = getPublicKeyRkyvSerialized(wasm, seed, index);

  console.log("Fetching stake info");

  const stakeInfoRequest = await request(
    pk,
    "get_stake",
    false,
    undefined,
    process.env.STAKE_CONTRACT,
    "1"
  );

  const stakeInfoRequestBuffer = await stakeInfoRequest.arrayBuffer();

  const stakeInfoRequestBytes = new Uint8Array(stakeInfoRequestBuffer);

  const args = JSON.stringify({
    stake_info: Array.from(stakeInfoRequestBytes),
  });

  const info = jsonFromBytes(call(wasm, args, wasm.get_stake_info));

  let epoch = info.eligiblity / 2160;

  // calculate epoch
  info["epoch"] = epoch;

  return info;
}

/**
 * Unstake
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} sender_index Index of the psk to unstake
 * @param {string} refund psk to refund this tx to
 */
export async function unstake(wasm, seed, sender_index, refund) {
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
    gas_limit: 2900000000,
    gas_price: 1,
  });

  console.log(args);

  const wfctProofArgs = jsonFromBytes(call(wasm, args, wasm.get_wfct_proof));
  console.log(wfctProofArgs);
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

  console.log(callDataArgs);

  const unstakeCallData = jsonFromBytes(
    call(wasm, callDataArgs, wasm.get_unstake_call_data)
  );

  console.log(unstakeCallData);

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

  execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    fee,
    2900000000,
    1
  );
}

/**
 * Allow a staker psk to stake
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} sender_index Index of the staker
 * @param {string} refund Where to refund this transaction to
 */
export async function stakeAllow(wasm, seed, sender_index, refund) {
  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  const info = await stakeInfo(wasm, seed, sender_index);

  let counter = 0;

  if (info.counter) {
    counter = info.counter;
  }

  const args = JSON.stringify({
    rng_seed: Array.from(rng_seed),
    seed: seed,
    refund: refund,
    sender_index: sender_index,
    owner_index: sender_index,
    counter: counter,
    gas_limit: 2900000000,
    gas_price: 1,
  });

  console.log(args);

  const allowCallData = jsonFromBytes(
    call(wasm, args, wasm.get_allow_call_data)
  );

  console.log(allowCallData);

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

  execute(
    wasm,
    seed,
    rng_seed,
    refund,
    undefined,
    callData,
    crossoverType,
    allowCallData.fee,
    2900000000,
    1
  );
}

async function withdrawReward() {}
