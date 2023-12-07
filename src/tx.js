// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getAllNotes } from "./indexedDB.js";
import { call, jsonFromBytes } from "./wasm.js";
import { txFromBlock } from "./graphql.js";
import { getPsks } from "./keys.js";
import { duskToLux, luxToDusk } from "./crypto.js";

/**
 * Convert a UnprovenTx recieved from execute into bytes we can send to the network
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} unprovenTx - UnprovenTx bytes recieived from calling execute in wasm
 * @returns {Uint8Array} var bytes of unproven tx ready to be sent to the network
 */
export function getUnprovenTxVarBytes(wasm, unprovenTx) {
  const args = JSON.stringify({
    bytes: Array.from(unprovenTx),
  });

  const result = jsonFromBytes(call(wasm, args, wasm.unproven_tx_to_bytes));

  return result.serialized;
}
/**
 * Prove a unrpoven transaction and return the bytes of the tx
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} unprovenTx Bytes of the unprovenTx recieved from the execute call
 * @param {Uint8Array} proof proof recieved from the network
 * @returns {Uint8Array} the proven transaction bytes ready to be sent to the network
 */
export function proveTx(wasm, unprovenTx, proof) {
  const args = JSON.stringify({
    unproven_tx: Array.from(unprovenTx),
    proof: Array.from(proof),
  });

  const result = jsonFromBytes(call(wasm, args, wasm.prove_tx));

  return result;
}

export async function history(wasm, seed, psk, callback) {
  await getAllNotes(psk, async (notes) => {
    const txData = [];
    const noteData = [];
    const index = getPsks(wasm, seed).indexOf(psk);

    for (const note of notes) {
      const blockHeight = note.block_height;
      const txs = await txFromBlock(blockHeight);

      txData.push({
        txs: txs,
        block_height: blockHeight,
      });

      noteData.push({
        pos: note.pos,
        psk: note.psk,
        note: note.note,
        nullifier: note.nullifier,
        block_height: note.block_height,
      });
    }

    const args = JSON.stringify({
      seed: Array.from(seed),
      index: index,
      notes: noteData,
      tx_data: txData,
    });

    const result = jsonFromBytes(call(wasm, args, wasm.get_history));
    const histories = result.history;

    callback(histories);
  });
}
