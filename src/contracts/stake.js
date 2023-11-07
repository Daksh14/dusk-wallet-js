// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "../wasm.js";
import { luxToDusk } from "../crypto.js";
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

  console.log(args);

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

  console.log(callDataArgs);

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

  info["epoch"] = epoch;

  return info;
}

async function unstake(wasm, seed, sender_index,) {
  const pk = 
}

async function stakeAllow() {}

async function withdrawReward() {}
