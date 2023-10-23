// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes, toBytes } from "./wasm.js";
import {
  getU64RkyvSerialized,
  getNotesRkyvSerialized,
  getNullifiersRkyvSerialized,
  getTreeLeafDeserialized,
  getNullifiersDeserialized,
} from "./rkyv.js";
import { stateDB, getLastPos } from "./indexedDB.js";
import { getNullifiers, checkIfOwned, unspentSpentNotes } from "./crypto.js";

// env variables
const RKYV_TREE_LEAF_SIZE = process.env.RKYV_TREE_LEAF_SIZE;
const TRANSFER_CONTRACT = process.env.TRANSFER_CONTRACT;
const LOCAL_NODE = process.env.LOCAL_NODE;

/**
 * This the most expensive function in this library,
 * This function fetches the notes and then persists them
 * to the indexed DB
 *
 * We then use the notes to calculate balance and perform staking
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed The seed of the wallet
 *
 */
export async function sync(wasm, seed, node = LOCAL_NODE) {
  let leafSize = parseInt(RKYV_TREE_LEAF_SIZE);

  // our last height where we start fetching from
  // We need to set this number for performance reasons,
  // every invidudal mnemonic wallet has its own last height where it
  // starts to store its notes from
  let lastPosDB = await getLastPos();
  // Get the leafs from the position above
  let resp = await request(
    getU64RkyvSerialized(wasm, lastPosDB),
    "leaves_from_pos",
    true,
    node
  );
  // what an indivdual leaf would be
  let leaf;
  // The notes we get from the network which we own.
  let notes = [];
  let block_heights = [];
  let nullifiers = [];
  let psks = [];
  let positions = [];
  let lastPos = 0;

  for await (const chunk of resp.body) {
    for (let i = 0; i < chunk.length; i += leafSize) {
      const leaf = chunk.slice(i, i + leafSize);
      // get the tree leaf rkyv serialized
      let treeLeaf = getTreeLeafDeserialized(wasm, leaf);

      let note = treeLeaf.note;
      let blockHeight = treeLeaf.block_height;
      let pos = treeLeaf.last_pos;

      let owned = checkIfOwned(wasm, seed, note);

      if (owned.is_owned) {
        lastPos = Math.max(lastPos, pos);

        notes.push(note);
        block_heights.push(blockHeight);
        positions.push(pos);
        nullifiers.push(owned.nullifier);
        psks.push(owned.public_spend_key);
      }
    }
  }

  let nullifiersSerialized = getNullifiersRkyvSerialized(wasm, nullifiers);

  // Fetch existing nullifiers from the node
  let existingNullifiersRemote = await request(
    nullifiersSerialized,
    "existing_nullifiers",
    false
  );

  let existingNullifiers = await existingNullifiersRemote.arrayBuffer();

  let existingNullifiersBytes = new Uint8Array(existingNullifiers);

  let allNotes = unspentSpentNotes(
    wasm,
    notes,
    nullifiers,
    existingNullifiersBytes,
    psks
  );

  let unspentNotes = allNotes.unspent_notes;
  let spentNotes = allNotes.spent_notes;

  // if we have anything to insert then we insert
  if (
    unspentNotes.length > 0 ||
    spentNotes.length > 0 ||
    // if the last pos we get from the node is bigger than the
    // last pos we have on the db then we need to update it
    lastPos >= lastPosDB
  ) {
    stateDB(unspentNotes, spentNotes, lastPos);
  }
}
/**
 * By default query the transfer contract unless given otherwise
 * @param {Array<Uint8Array>} data Data that is sent with the request
 * @param {string} request_name Name of the request we are performing
 * @param {boolean} stream If you want the response streamed or not
 * @param {string} node Node address, by default LOCAL_NODe
 * @param {string} target target address, by default transfer contract
 * @param {string} targetType the target number in string
 * @returns {Response} response Result of the fetch
 */
export async function request(
  data,
  request_name,
  stream,
  node = LOCAL_NODE,
  target = TRANSFER_CONTRACT,
  targetType = "1"
) {
  let request_name_bytes = toBytes(request_name);
  let number = numberToLittleEndianByteArray(request_name.length);
  let length = number.length + request_name_bytes.length + data.length;

  // finalize the bytes we send the node as POST request
  let request = new Uint8Array(length);

  request.set(number, 0);
  request.set(request_name_bytes, number.length);
  request.set(new Uint8Array(data), number.length + request_name_bytes.length);

  let headers = {
    "Content-Type": "application/octet-stream",
    "x-rusk-version": "0.6.0",
  };

  if (stream) {
    headers["Rusk-Feeder"] = "1";
  }

  try {
    /// http://127.0.0.1:8080/ + 1/ + 00002 = http://127.0.0.1:8080/1/00002
    let resp = await fetch(node + targetType + "/" + target, {
      method: "POST",
      headers: headers,
      body: request,
    });
    return resp;
  } catch (e) {
    throw new Error("Error while sending request to node: " + e);
  }
}

/**
 *
 * @param {number} pos - Position of the note we want the opening of
 * @param {string} node - Node address
 * @returns {Uint8Array} - Bytes of the UInt8Array
 */
export async function fetchOpenings(pos, node = LOCAL_NODE) {
  try {
    let response = await request(pos, "opening", false);

    let buffer = await response.arrayBuffer();

    let bytes = new Uint8Array(buffer);
    return bytes;
  } catch (e) {
    console.log("Fetching Openings failed: " + e);
  }
}
/**
 * Seerialize a number to a little endian byte array
 * @param {number} number to serialize
 * @returns {Uint8Array} the bytes
 */
function numberToLittleEndianByteArray(num) {
  let byteArray = new Uint8Array(4); // Assuming a 32-bit number

  for (let i = 0; i < 4; i++) {
    byteArray[i] = (num >> (i * 8)) & 0xff;
  }

  return byteArray;
}
