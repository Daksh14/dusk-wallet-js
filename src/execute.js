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
 * @param {Uint8Array} seed - Walconst seed
 * @param {Uint8Array} rng_seed - Seed for the rng
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
  rng_seed,
  psk,
  output,
  callData,
  crossover,
  fee,
  gas_limit,
  gas_price
) {
  getUnpsentNotes(psk, async (notes) => {
    const openings = [];
    const allNotes = [];

    for (const noteData of notes) {
      console.log(noteData);
      const pos = noteData.pos;
      const fetchedOpening = await fetchOpenings(
        getU64RkyvSerialized(wasm, pos)
      );

      const opening = Array.from(fetchedOpening);

      if (opening.length > 0) {
        openings.push(opening);
      }

      allNotes.push(noteData.note);
    }

    const openingsSerialized = Array.from(
      getOpeningsSerialized(wasm, openings)
    );

    console.log("allNotes:", allNotes);

    const inputs = Array.from(getNotesRkyvSerialized(wasm, allNotes));

    const args = JSON.stringify({
      call: callData,
      crossover: crossover,
      seed: seed,
      fee: fee,
      rng_seed: Array.from(rng_seed),
      inputs: inputs,
      refund: psk,
      output: output,
      openings: openingsSerialized,
      gas_limit: gas_limit,
      gas_price: gas_price,
    });

    console.log(args);

    const unprovenTx = jsonFromBytes(call(wasm, args, wasm.execute)).tx;

    console.log("unrpovenTx length: " + unprovenTx.length);

    const varBytes = getUnprovenTxVarBytes(wasm, unprovenTx);
    const proofReq = await request(
      varBytes,
      "prove_execute",
      false,
      undefined,
      "rusk",
      "2"
    );

    console.log("prove_execute status code: " + proofReq.status);

    const buffer = await proofReq.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const tx = proveTx(wasm, unprovenTx, bytes);

    const preVerifyReq = await request(
      tx,
      "preverify",
      false,
      undefined,
      "rusk",
      "2"
    );

    console.log("preverify request status code: " + preVerifyReq.status);

    const propogateReq = await request(
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
