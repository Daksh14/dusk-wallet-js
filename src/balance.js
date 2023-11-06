// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "./wasm.js";
import { getUnpsentNotes } from "./indexedDB.js";
import { getNotesRkyvSerialized } from "./rkyv.js";
import { duskToLux } from "./crypto.js";

/**
 * Get balance from given unspent notes and seed
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Seed for the wallet
 * @param {string} psk - bs58 encoded string of psk of the address
 * @param {callback} callback - function(balance_value) {}
 * @returns {object} balanceResponse - object.maximum and object.value
 */
export function getBalance(wasm, seed, psk, callback) {
  getUnpsentNotes(psk, function (notes) {
    const unspentNotes = notes.map((object) => object.note);

    const serializedNotes = getNotesRkyvSerialized(wasm, unspentNotes);

    const balanceArgs = JSON.stringify({
      seed: Array.from(seed),
      notes: Array.from(serializedNotes),
    });

    const obj = jsonFromBytes(call(wasm, balanceArgs, wasm.balance));

    // convert the dusk values to lux
    obj.value = duskToLux(wasm, obj.value);
    obj.maximum = duskToLux(wasm, obj.maximum);

    callback(obj);
  });
}
