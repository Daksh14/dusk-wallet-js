// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "./wasm.js";

/**
 * Get nullifiers for the notes
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} notes - Notes we want the nullifiers of
 * @returns {Uint8Array} nullifiers - rkyv serialised nullifiers in a Vector
 */
export function getNullifiers(wasm, seed, notes) {
  const json = JSON.stringify({
    seed: Array.from(seed),
    notes: Array.from(notes),
  });

  return call(wasm, json, wasm.nullifiers);
}

/**
 * Check if a note is ownewd by any of the view keys
 * for given seed.
 * @param {WebAssembly.Exports} - wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} note - Note Singular Note we want to find the ownership of
 * @returns {boolean} ownership - true if the note is owned by the seed
 */
export function checkIfOwned(wasm, seed, note) {
  const json = JSON.stringify({
    seed: Array.from(seed),
    note: Array.from(note),
  });

  return jsonFromBytes(call(wasm, json, wasm.check_note_ownership));
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
  psks
) {
  const args = JSON.stringify({
    notes: notes,
    nullifiers_of_notes: nullifiersOfNote,
    block_heights: blockHeights,
    existing_nullifiers: Array.from(existingNullifiers),
    psks: psks,
  });

  return jsonFromBytes(call(wasm, args, wasm.unspent_spent_notes));
}

/**
 * Convert lux to dusk
 * @param {WebAssembly.Exports} wasm
 * @param {number} dusk Dusk amount to convert to lux
 * @returns {number} lux amount
 */
export function duskToLux(wasm, dusk) {
  const args = JSON.stringify({
    dusk: dusk,
  });

  return jsonFromBytes(call(wasm, args, wasm.dusk_to_lux)).lux;
}

/**
 * Convert lux to dusk
 * @param {WebAssembly.Exports} wasm
 * @param {number} lux Lux amount to convert to dusk
 * @returns {number} dusk amount
 */
export function luxToDusk(wasm, lux) {
  const args = JSON.stringify({
    lux: lux,
  });

  return jsonFromBytes(call(wasm, args, wasm.lux_to_dusk)).dusk;
}
