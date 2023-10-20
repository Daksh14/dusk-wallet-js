// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "./wasm.js";
import { getUnpsentNotes } from "./indexedDB.js";
import { getNotesRkyvSerialized } from "./rkyv.js";

/**
 * Get balance from given unspent notes and seed
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Seed for the wallet
 * @param {string} psk - bs58 encoded string of psk of the address
 * @param {callback} callback - function(balance_value) {}
 * @returns {object} balanceResponse - object.maximum and object.value
 */
export async function getBalance(wasm, seed, psk, callback) {
  await getUnpsentNotes(psk, function (notes) {
    let unspentNotes = notes.map((object) => object.note);

    let serializedNotes = getNotesRkyvSerialized(wasm, unspentNotes);

    let balanceArgs = JSON.stringify({
      seed: Array.from(seed),
      notes: Array.from(serializedNotes),
    });

    callback(jsonFromBytes(call(wasm, balanceArgs, wasm.balance)));
  });
}
