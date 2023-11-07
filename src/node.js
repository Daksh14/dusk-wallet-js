// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { toBytes } from "./wasm.js";
import {
  getU64RkyvSerialized,
  getNullifiersRkyvSerialized,
  getTreeLeafDeserialized,
} from "./rkyv.js";
import {
  stateDB,
  getLastPos,
  getAllUnpsentNotes,
  deleteUnspentNotesInsertSpentNotes,
} from "./indexedDB.js";
import { checkIfOwned, unspentSpentNotes } from "./crypto.js";

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
 * @param {Uint8Array} seed The seed of the walconst
 *
 */
export async function sync(wasm, seed, node = LOCAL_NODE) {
  const leafSize = parseInt(RKYV_TREE_LEAF_SIZE);

  // our last height where we start fetching from
  // We need to set this number for performance reasons,
  // every invidudal mnemonic walconst has its own last height where it
  // starts to store its notes from
  const lastPosDB = await getLastPos();
  // Get the leafs from the position above
  const resp = await request(
    getU64RkyvSerialized(wasm, lastPosDB),
    "leaves_from_pos",
    true,
    node
  );
  // what an indivdual leaf would be
  let leaf;
  // The notes we get from the network which we own.
  const notes = [];
  const block_heights = [];
  const nullifiers = [];
  const psks = [];
  const positions = [];
  let lastPos = 0;

  for await (const chunk of resp.body) {
    for (let i = 0; i < chunk.length; i += leafSize) {
      leaf = chunk.slice(i, i + leafSize);
      // get the tree leaf rkyv serialized
      const treeLeaf = getTreeLeafDeserialized(wasm, leaf);

      const note = treeLeaf.note;
      const blockHeight = treeLeaf.block_height;
      const pos = treeLeaf.last_pos;

      const owned = checkIfOwned(wasm, seed, note);

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

  const nullifiersSerialized = getNullifiersRkyvSerialized(wasm, nullifiers);

  // Fetch existing nullifiers from the node
  const existingNullifiersRemote = await request(
    nullifiersSerialized,
    "existing_nullifiers",
    false
  );

  const existingNullifiers = await existingNullifiersRemote.arrayBuffer();

  const existingNullifiersBytes = new Uint8Array(existingNullifiers);

  const allNotes = unspentSpentNotes(
    wasm,
    notes,
    nullifiers,
    existingNullifiersBytes,
    psks
  );

  const unspentNotes = Array.from(allNotes.unspent_notes);
  const spentNotes = Array.from(allNotes.spent_notes);

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

  // Move the unspent notes to spent notes if they were spent
  const unspentNotesNullifiers = [];
  const unspentNotesTemp = [];
  const unspentNotesPsks = [];
  const unspentNotesIds = [];

  const correctNotes = async (unspentNotesNullifiers) => {
    const unspentNotesNullifiersSerialized = getNullifiersRkyvSerialized(
      wasm,
      unspentNotesNullifiers
    );

    // Fetch existing nullifiers from the node
    const unpsentNotesExistingNullifiersRemote = await request(
      unspentNotesNullifiersSerialized,
      "existing_nullifiers",
      false
    );

    const unspentNotesExistingNullifiers =
      await unpsentNotesExistingNullifiersRemote.arrayBuffer();

    const unspentNotesExistingNullifiersBytes = new Uint8Array(
      unspentNotesExistingNullifiers
    );

    const correctedNotes = unspentSpentNotes(
      wasm,
      unspentNotesTemp,
      unspentNotesNullifiers,
      unspentNotesExistingNullifiersBytes,
      unspentNotesPsks
    );

    const unspentNotesCorrected = Array.from(correctedNotes.unspent_notes).map(
      (unspentNotedata) => unspentNotedata.note
    );

    const idsToRemove = [];

    unspentNotesTemp.forEach((note, index) => {
      let needsCorrection = true;
      unspentNotesCorrected.forEach((correctedNote) => {
        if (compareNotes(note, correctedNote)) {
          needsCorrection = false;
        }
      });

      if (needsCorrection) {
        idsToRemove.push(unspentNotesIds[index]);
      }
    });

    deleteUnspentNotesInsertSpentNotes(
      idsToRemove,
      Array.from(correctedNotes.spent_notes)
    );
  };

  getAllUnpsentNotes(async (allUnspentNotes) => {
    for (const unspentNote of await allUnspentNotes) {
      unspentNotesNullifiers.push(unspentNote.nullifier);
      unspentNotesTemp.push(unspentNote.note);
      unspentNotesPsks.push(unspentNote.psk);
      unspentNotesIds.push(unspentNote.id);
    }

    correctNotes(unspentNotesNullifiers);
  });
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
  const request_name_bytes = toBytes(request_name);
  const number = numberToLittleEndianByteArray(request_name.length);
  const length = number.length + request_name_bytes.length + data.length;

  // finalize the bytes we send the node as POST request
  const request = new Uint8Array(length);

  request.set(number, 0);
  request.set(request_name_bytes, number.length);
  request.set(new Uint8Array(data), number.length + request_name_bytes.length);

  const headers = {
    "Content-Type": "application/octet-stream",
    "rusk-version": "0.7.0-rc",
  };

  if (stream) {
    headers["Rusk-Feeder"] = "1";
  }

  try {
    /// http://127.0.0.1:8080/ + 1/ + 00002 = http://127.0.0.1:8080/1/00002
    const resp = await fetch(node + targetType + "/" + target, {
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
    const response = await request(pos, "opening", false, node);

    const buffer = await response.arrayBuffer();

    const bytes = new Uint8Array(buffer);
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
  const byteArray = new Uint8Array(4); // Assuming a 32-bit number

  for (let i = 0; i < 4; i++) {
    byteArray[i] = (num >> (i * 8)) & 0xff;
  }

  return byteArray;
}

/**
 * Compare notes and return true or false
 * @param {Uint8Array} noteOne
 * @param {Uint8Array} noteTwo
 * @returns {boolean} true if the notes are equal, false otherwise
 */
function compareNotes(noteOne, noteTwo) {
  let i = noteOne.length;

  while (i--) {
    if (noteOne[i] !== noteTwo[i]) return false;
  }

  return true;
}
