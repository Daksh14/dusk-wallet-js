// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

// This includes helper methods to rkyv serialize deserialize stuff
import { call, jsonFromBytes } from "./wasm.js";

/**
 * Convert a number to rkyv serialized bytes
 * @param {WebAssembly.Exports} wasm
 * @param {number} number we want to rkyv serialize
 * @returns {Uint8Array} rkyv serialized bytes of the u64
 */
export function getU64RkyvSerialized(wasm, num) {
  const args = JSON.stringify({
    value: num,
  });

  const bytes = call(wasm, args, wasm.rkyv_u64);

  return bytes;
}
/**
 * Convert [Note] into Vec<u8> which is Vec<Note> rkyv serialized
 * @param {WebAssembly.Exports} wasm
 * @param {Array<any>} notes The notes we want to rkyv serialize
 * @returns {Uint8Array} rkyv serialized bytes of the Vec<Note>
 */
export function getNotesRkyvSerialized(wasm, notes) {
  const args = JSON.stringify({
    notes: notes,
  });

  const bytes = call(wasm, args, wasm.rkyv_notes_array);

  return bytes;
}
/**
 * Convert Array<Uint8Array> into Vec<u8> which is Vec<BlsScalar> rkyv serialized into a Vec<u8>
 * @param {WebAssembly.Exports} wasm
 * @param {Array<any>} bytes The bytes of the Vec<BlsScalar> (nullifiers)
 * @returns {Array<Uint8Array>} rkyv serialized bytes Vec<Vec<u8>>
 */
export function getNullifiersRkyvSerialized(wasm, bytes) {
  const args = JSON.stringify({
    bytes: Array.from(bytes),
  });

  const result = call(wasm, args, wasm.rkyv_bls_scalar_array);

  return result;
}
/**
 * Convert Uint8Array into Vec<Vec<u8>> which is Vec<BlsScalar> rkyv serialized into a Vec<Vec<u8>>
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} bytes The bytes of the Vec<BlsScalar> (nullifiers)
 * @returns {Array<Uint8Array>} rkyv serialized bytes Vec<Vec<u8>>
 */
export function getNullifiersDeserialized(wasm, bytes) {
  const args = JSON.stringify({
    bytes: Array.from(bytes),
  });

  const result = jsonFromBytes(call(wasm, args, wasm.bls_scalar_array_rkyv));

  return result.bytes;
}

/**
 * Convert Array<OpeningsBytes> -> Vec<Openings> -> rkyv serialized Vec<u8>
 * @param {WebAssembly.Exports} wasm
 * @param {Array<Uint8Array>} bytes - Array<Bytes> the bytes are rkyv serialized openings
 * @returns {Uint8Array} rkyv serialized Vec<Openings>
 */
export function getOpeningsSerialized(wasm, bytes) {
  const args = JSON.stringify({
    openings: bytes,
  });

  const result = call(wasm, args, wasm.rkyv_openings_array);

  return result;
}
