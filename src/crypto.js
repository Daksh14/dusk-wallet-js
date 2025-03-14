// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, call_raw } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";

const CHUNK_SIZE = 632 * 100;

/**
 * Get nullifiers for the notes
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} notes - Notes we want the nullifiers of
 * @returns {Uint8Array} nullifiers - rkyv serialised nullifiers in a Vector
 */
export function getNullifiers(wasm, [...seed], [...notes]) {
  const json = {
    seed,
    notes,
  };

  return call(wasm, json, "nullifiers");
}

/**
 * Callback type for getOwnedNotes function progress
 *
 * @callback onprogress
 * @param {number} progress - Progress percentage as floating number from 0 to 1 (0-100%)
 */

/**
 * Progress Options for the `getOwnedNotes` function
 * @typedef {Object} ProgressOptions
 * @property {AbortSignal} [signal] The signal to abort the `getOwnedNotes` processing
 * @property {onprogress} [onprogress] The callback for progress report
 */

/**
 * Check if a note is ownewd by any of the view keys
 * for given seed.
 * @param {WebAssembly.Exports} - wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} leaves - leafs we get from the node
 * @param {ProgressOptions} [options] - the progress options
 * @returns {Promise<object>} - noteData
 */
export async function getOwnedNotes(
  wasm,
  seed,
  leaves,
  { onprogress, signal } = {},
) {
  const totalBytes = leaves.length;
  const noteData = {
    notes: [],
    blockHeights: [],
    pks: [],
    nullifiers: [],
    lastPos: 0,
  };
  const bytesPerFunction = onprogress
    ? Math.min(totalBytes, CHUNK_SIZE)
    : totalBytes;
  const total = totalBytes / bytesPerFunction;

  let bytesProcessed = 0;

  for (let i = 0; i < total; i++) {
    const slice = leaves.subarray(
      i * bytesPerFunction,
      (i + 1) * bytesPerFunction,
    );

    const args = new Uint8Array(seed.length + slice.length);
    args.set(seed);
    args.set(slice, seed.length);

    // inform progress before actually processing
    if (typeof onprogress === "function") {
      bytesProcessed = Math.min(bytesProcessed + CHUNK_SIZE, totalBytes);
      onprogress(bytesProcessed / totalBytes);
    }

    const owned = await call_raw(
      wasm,
      args,
      "check_note_ownership",
      signal,
    ).then(parseEncodedJSON);

    noteData.notes = noteData.notes.concat(owned.notes);
    // We use number here because currently wallet-core doesn't know
    // how to parse json with bigInt since there's no specification for BigInt
    //
    // FIXME: We should use bigInt
    //
    // See: <https://github.com/dusk-network/dusk-wallet-js/issues/59>
    noteData.blockHeights = noteData.blockHeights.concat(
      owned.block_heights.split(",").map(Number),
    );

    noteData.pks = noteData.pks.concat(owned.public_spend_keys);
    noteData.nullifiers = noteData.nullifiers.concat(owned.nullifiers);

    noteData.lastPos = owned.last_pos;
  }

  return noteData;
}

/**
 * Sort all the notes into unspent and spent notes given existing nullifiers
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Array<Uint8Array>} notes Array of rkyv serialized notes
 * @param {Array<Uint8Array>} nullifiersOfNote Array of rkyv serialized BlsScalar
 * @param {Array<number>} blockHeights Array of block heights of the notes
 * @param {Uint8Array} existingNullifiers Vec<BlsScalar> from the node
 * @param {Array<string>} psks Public spend keys of the notes
 * @returns {object} json of the response
 */
export function unspentSpentNotes(
  wasm,
  notes,
  nullifiersOfNote,
  blockHeights,
  existingNullifiers,
  psks,
) {
  const args = {
    notes: notes,
    nullifiers_of_notes: nullifiersOfNote,
    block_heights: blockHeights,
    existing_nullifiers: Array.from(existingNullifiers),
    psks: psks,
  };
  return call(wasm, args, "unspent_spent_notes").then(parseEncodedJSON);
}

/**
 * Convert lux to dusk
 * @param {WebAssembly.Exports} wasm
 * @param {number} dusk Dusk amount to convert to lux
 * @returns {Promise<number>} lux amount
 */
export async function duskToLux(wasm, dusk) {
  const args = {
    dusk: dusk,
  };

  return parseEncodedJSON(await call(wasm, args, "dusk_to_lux")).lux;
}

/**
 * Convert lux to dusk
 * @param {WebAssembly.Exports} wasm
 * @param {number} lux Lux amount to convert to dusk
 * @returns {number} dusk amount
 */
export async function luxToDusk(wasm, lux) {
  const args = {
    lux: lux,
  };

  return parseEncodedJSON(await call(wasm, args, "lux_to_dusk")).dusk;
}
