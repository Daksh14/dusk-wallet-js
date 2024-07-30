// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, call_raw } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";
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
 * @callback syncProgress
 * @param {number} current - last note position synced
 */

/**
 * Check if a note is ownewd by any of the view keys
 * for given seed.
 * @param {WebAssembly.Exports} - wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} leaves - leafs we get from the node
 * @param {syncProgress} onprogress - callback for progress report
 * @returns {Promise<object>} - noteData
 */
export async function getOwnedNotes(wasm, seed, leaves, onprogress) {
  let noteData = {
    notes: [],
    blockHeights: [],
    pks: [],
    nullifiers: [],
    lastPos: 0,
  };

  const bytesPerFunction = 632 * 100;
  const total = leaves.length / bytesPerFunction;

  // reuse seed buffer for each chunk
  const seedBytes = new Uint8Array(seed.length);
  seedBytes.set(seed);

  for (let i = 0; i < total; i++) {
    const slice = leaves.slice(
      i * bytesPerFunction,
      (i + 1) * bytesPerFunction,
    );

    const args = new Uint8Array(seedBytes.length + slice.length);
    args.set(seedBytes);
    args.set(slice, seedBytes.length);

    const owned = await call_raw(wasm, args, "check_note_ownership").then(
      parseEncodedJSON,
    );

    owned.notes.forEach((v) => noteData.notes.push(v));
    // We use number here because currently wallet-core doesn't know
    // how to parse json with bigInt since there's no specification for BigInt
    //
    // FIXME: We should use bigInt
    //
    // See: <https://github.com/dusk-network/dusk-wallet-js/issues/59>
    owned.block_heights
      .split(",")
      .map(Number)
      .forEach((v) => noteData.blockHeights.push(v));

    owned.public_spend_keys.forEach((v) => noteData.pks.push(v));
    owned.nullifiers.forEach((v) => noteData.nullifiers.push(v));

    noteData.lastPos = owned.last_pos;

    onprogress(noteData.lastPos);
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
