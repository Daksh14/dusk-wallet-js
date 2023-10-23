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
  let json = JSON.stringify({
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
  let json = JSON.stringify({
    seed: Array.from(seed),
    note: Array.from(note),
  });

  return jsonFromBytes(call(wasm, json, wasm.check_note_ownership));
}

/**
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Array<Uint8Array>} notes Array of rkyv serialized notes
 * @param {Array<Uint8Array>} nullifiersOfNote Array of rkyv serialized BlsScalar
 * @param {Uint8Array} existingNullifiers Vec<BlsScalar> from the node
 * @param {Array<string>} psks Public spend keys of the notes
 * @returns
 */
export function unspentSpentNotes(
  wasm,
  notes,
  nullifiersOfNote,
  existingNullifiers,
  psks
) {
  let args = JSON.stringify({
    notes: notes,
    nullifiers_of_notes: nullifiersOfNote,
    existing_nullifiers: Array.from(existingNullifiers),
    psks: psks,
  });

  return jsonFromBytes(call(wasm, args, wasm.unspent_spent_notes));
}
