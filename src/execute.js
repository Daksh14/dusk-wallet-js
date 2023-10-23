// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getUnpsentNotes } from "./indexedDB.js";
import { fetchOpenings, request } from "./node.js";
import {
  getNotesRkyvSerialized,
  getOpeningsSerialized,
  getU64RkyvSerialized,
} from "./rkyv.js";
import { call, jsonFromBytes } from "./wasm.js";
import { getUnprovenTxVarBytes, proveTx } from "./tx.js";

/**
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Wallet seed
 * @param {string} psk - bs58 encoded public spend key string
 * @param {object} output - Output note parameters
 * @param {object} call - call object
 * @param {object} crossover - crossover object
 * @param {number} gas_limit - gas_limit value
 * @param {number} gas_price - gas_price value
 * @param {Function} callback - callback(unproven_trasnaction_bytes)
 */
export function execute(
  wasm,
  seed,
  psk,
  output,
  callData,
  crossover,
  gas_limit,
  gas_price
) {
  let rng_seed = new Uint8Array(64);
  crypto.getRandomValues(rng_seed);

  getUnpsentNotes(psk, async (notes) => {
    let openings = [];
    let allNotes = [];

    await Promise.all(
      notes.map(async (noteData) => {
        let pos = noteData.pos;
        let fetchedOpening = await fetchOpenings(
          getU64RkyvSerialized(wasm, pos)
        );

        openings.push(Array.from(fetchedOpening));
        allNotes.push(noteData.note);
      })
    );

    let openingsSerialized = getOpeningsSerialized(wasm, openings);
    let inputs = getNotesRkyvSerialized(wasm, allNotes);

    let args = JSON.stringify({
      call: callData,
      crossover: crossover,
      seed: seed,
      rng_seed: Array.from(rng_seed),
      inputs: Array.from(inputs),
      refund: psk,
      output: output,
      openings: Array.from(openingsSerialized),
      gas_limit: gas_limit,
      gas_price: gas_price,
    });

    let unprovenTx = jsonFromBytes(call(wasm, args, wasm.execute)).tx;

    console.log("unrpovenTx length: " + unprovenTx.length);

    let varBytes = getUnprovenTxVarBytes(wasm, unprovenTx);
    let proofReq = await request(
      varBytes,
      "prove_execute",
      false,
      undefined,
      "rusk",
      "2"
    );

    console.log("prove_execute status code: " + proofReq.status);

    let buffer = await proofReq.arrayBuffer();
    let bytes = new Uint8Array(buffer);

    let tx = proveTx(wasm, unprovenTx, bytes);

    let preVerifyReq = await request(
      tx,
      "preverify",
      false,
      undefined,
      "rusk",
      "2"
    );

    console.log("preverify request status code: " + preVerifyReq.status);

    let bufferPreVerifyReq = await preVerifyReq.arrayBuffer();
    let bytesPreVerifyReq = new Uint8Array(bufferPreVerifyReq);

    let propogateReq = await request(
      tx,
      "propagate_tx",
      false,
      undefined,
      "Chain",
      "2"
    );

    console.log("propogating chain request status: " + propogateReq.status);
  });
}
