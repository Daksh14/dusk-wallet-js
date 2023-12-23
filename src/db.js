// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { Dexie, indexedDB } from "../deps.js";
import { unspentSpentNotes } from "./crypto.js";
import { request, responseBytes } from "./node.js";
import { getNullifiersRkyvSerialized } from "./rkyv.js";

// Set Polyfill
if (globalThis.indexedDB === undefined) {
  Dexie.dependencies.indexedDB = indexedDB;
}

/**
 * @class NoteData
 * @type {Object}
 * @property {UInt8Array} note The rkyv serialized note.
 * @property {UInt8Array} nullifier The rkyv serialized BlsScalar.
 * @property {number} pos The position of the node
 * @property {number} block_height The block height of the note
 * @property {string} psk The bs58 encoded public spend key of the note
 */
export function NoteData(note, psk, pos, nullifier, block_height) {
  this.note = note;
  this.psk = psk;
  this.pos = pos;
  this.nullifier = nullifier;
  this.block_height = block_height;
}

/**
 * Persist the state of unspent_notes and spent_notes in the indexedDB
 * This is called by the sync function
 *
 * @param {Array<NoteData>} unspent_notes Notes which are not spent
 * @param {Array<NoteData>} spent_notes
 * @param {number} pos The position we are at right now
 * @ignore Only called by the sync function
 */
export async function insertSpentUnspentNotes(unspentNotes, spentNotes, pos) {
  const db = new Dexie("state");

  db.version(1).stores({
    // Added a autoincremented id for good practice
    // if we need to index it in future
    unspentNotes: "pos,psk,nullifier",
    spentNotes: "pos,psk,nullifier",
  });

  try {
    if (localStorage.getItem("lastPos") == null) {
      console.log("Set last pos in local storage: " + pos);
    }

    localStorage.setItem("lastPos", Math.max(pos, getLastPos()));
  } catch (e) {
    console.error("Cannot set pos in local storage, the wallet will be slow");
  }

  await db.unspentNotes
    .bulkPut(unspentNotes)
    .then(() => {
      if (unspentNotes.length > 0) {
        console.log("Persisted unspent notes");
      }
    })
    .catch(function (e) {
      console.error(
        "Some insert operations did not while pushing unspent notes. " +
          e.failures.length +
          " failures"
      );
    });

  await db.spentNotes
    .bulkPut(spentNotes)
    .then(() => {
      if (spentNotes.length > 0) {
        console.log("Persisted spent notes");
      }

      db.close();
    })
    .catch(Dexie.BulkError, function (e) {
      console.error(
        "Some insert operations did not while pushing spent notes. " +
          e.failures.length +
          " failures"
      );
    });
}

/**
 * Fetch unspent notes from the IndexedDB if there are any
 *
 * @param {string} psk - bs58 encoded public spend key to fetch the unspent notes of
 * @returns {Promise<Array<NoteData>>} notes - unspent notes belonging to the psk
 * @ignore Only called by the sync function
 */
export async function getUnpsentNotes(psk) {
  const dbHandle = new Dexie("state");

  const db = await dbHandle.open().catch((error) => {
    console.error("Error while getting unspent notes: " + error);
  });

  const myTable = db.table("unspentNotes");

  if (myTable) {
    const notes = myTable.filter((note) => note.psk == psk);
    const result = await notes.toArray();

    return result;
  }
}

/**
 * Fetch spent notes from the IndexedDB if there are any
 *
 * @param {string} psk bs58 encoded public spend key to fetch the unspent notes of
 * @returns {Array<NoteData>}  spent notes of the psk
 * @ignore Only called by the sync function
 */
export async function getSpentNotes(psk) {
  const dbHandle = new Dexie("state");

  const db = await dbHandle.open().catch((error) => {
    console.error("Error while getting spent notes: " + error);
  });

  const myTable = db.table("spentNotes");

  if (myTable) {
    const notes = myTable.filter((note) => note.psk == psk);
    const result = await notes.toArray();

    return result;
  }
}

/**
 * Fetch lastPos from the localStorage if there is any 0 by default
 *
 * @returns {number} lastPos the position where to fetch from
 * @ignore Only called by the sync function
 */
export function getLastPos() {
  try {
    const lastPos = localStorage.getItem("lastPos");

    if (lastPos == null) {
      console.warn("Last pos is null, need to sync");
      return 0;
    } else {
      try {
        // We wanna fetch from the +1 pos if there is an existing last position
        return parseInt(lastPos);
      } catch (e) {
        console.error("Invalid lastPos set");
        localStorage.removeItem("lastPos");

        return 0;
      }
    }
  } catch (e) {
    console.error("Cannot retrieve lastPos in local storage", e);
  }
}

/**
 * Increment the lastPos by 1 if non zero
 * @returns {number} lastPos the position where to fetch from
 */
export function getLastPosIncremented() {
  const pos = getLastPos();

  return pos === 0 ? pos : pos + 1;
}

/**
 * Given bs58 encoded psk, fetch all the spent and unspent notes for that psk
 *
 * @param {string} psk
 * @returns {Array<NoteData>} spent and unspent notes of the psk contactinated
 * @ignore Only called by the sync function
 */
export async function getAllNotes(psk) {
  const dbHandle = new Dexie("state");

  const db = await dbHandle.open().catch((error) => {
    console.error("Error while all notes: " + error);
  });

  const unspentNotesTable = db
    .table("unspentNotes")
    .filter((note) => note.psk == psk);

  const spentNotesTable = db
    .table("spentNotes")
    .filter((note) => note.psk == psk);

  const unspent = await unspentNotesTable.toArray();
  const spent = await spentNotesTable.toArray();

  const concat = spent.concat(unspent);

  return concat;
}

/**
 * Read all the unspent notes and check if they are spent from the node
 * If they are spent then move from unspent to spent
 *
 * @param {WebAssembly.Exports} wasm
 *
 * @returns {Promise} Promise object which resolves after the corrected notes are inserted
 * @ignore Only called by the sync function
 */
export async function correctNotes(wasm) {
  // Move the unspent notes to spent notes if they were spent
  const unspentNotesNullifiers = [];
  const unspentNotesTemp = [];
  const unspentNotesPsks = [];
  const unspentNotesPos = [];
  const unspentNotesBlockHeights = [];

  // grab all the unspent notes and put the data of those unspent notes in arrays
  const allUnspentNotes = await getAllUnpsentNotes();

  for (const unspentNote of await allUnspentNotes) {
    unspentNotesNullifiers.push(unspentNote.nullifier);
    unspentNotesTemp.push(unspentNote.note);
    unspentNotesPsks.push(unspentNote.psk);
    unspentNotesPos.push(unspentNote.pos);
    unspentNotesBlockHeights.push(unspentNote.block_height);
  }

  // start the correction of the notes
  // get the nullifiers
  const unspentNotesNullifiersSerialized = getNullifiersRkyvSerialized(
    wasm,
    unspentNotesNullifiers
  );

  // Fetch existing nullifiers from the node
  const unspentNotesExistingNullifiersBytes = await responseBytes(
    await request(
      unspentNotesNullifiersSerialized,
      "existing_nullifiers",
      false
    )
  );

  // calculate the unspent and spent notes
  // from all the unspent note in the db
  // their nullifiers
  const correctedNotes = unspentSpentNotes(
    wasm,
    unspentNotesTemp,
    unspentNotesNullifiers,
    unspentNotesBlockHeights,
    unspentNotesExistingNullifiersBytes,
    unspentNotesPsks
  );

  // These are the spent notes which were unspent before
  const correctedSpentNotes = Array.from(correctedNotes.spent_notes);
  const posToRemove = correctedSpentNotes.map((noteData) => noteData.pos);

  return deleteUnspentNotesInsertSpentNotes(posToRemove, correctedSpentNotes);
}

/**
 * Fetch all unspent notes from the IndexedDB if there are any
 * @returns {Promise<Array<NoteData>>} unspent notes of the psk
 * @ignore Only called by the sync function
 */
async function getAllUnpsentNotes() {
  const dbHandle = new Dexie("state");

  const db = await dbHandle.open().catch((error) => {
    console.error("Error while getting all unspent notes: " + error);
  });

  const myTable = db.table("unspentNotes");

  if (myTable) {
    const result = await myTable.toArray();

    return result;
  }
}

/**
 * Delete unspent notes given their Pos and insert spent notes given data
 * We want to move notes from unspent to spent when they are used in a tx
 *
 * @param {Array<number>} unspentNotesPos - ids of the unspent notes to delete
 * @param {Array<NoteData>} spentNotes - spent notes to insert
 * @ignore Only called by the sync function
 */
async function deleteUnspentNotesInsertSpentNotes(unspentNotesPos, spentNotes) {
  const dbHandle = new Dexie("state");

  const db = await dbHandle.open().catch(Dexie.BulkError, function (e) {
    console.error(
      "Some insert operations did not while deleting unspent notes. " +
        e.failures.length +
        " failures"
    );
  });

  const unspentNotesTable = db.table("unspentNotes");
  if (unspentNotesTable) {
    await unspentNotesTable.bulkDelete(unspentNotesPos);
  }

  const spentNotesTable = db.table("spentNotes");

  if (spentNotesTable) {
    return spentNotesTable.bulkPut(spentNotes);
  }
}
