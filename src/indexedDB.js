// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.
import { Dexie, indexedDB } from "../deps.js";

if (globalThis.indexedDB === undefined) {
  Dexie.dependencies.indexedDB = indexedDB;
}

/**
 * Persist the state of unspent_notes and spent_notes in the indexedDB
 * This is called by the sync function
 * @param {Array<Uint8Array>} unspent_notes Notes which are not spent
 * @param {Array<Uint8Array>} spent_notes
 * @param {number} pos The position we are at right now
 */
export async function stateDB(unspentNotes, spentNotes, pos) {
  const db = new Dexie("state");

  db.version(1).stores({
    // Added a autoincremented id for good practice
    // if we need to index it in future
    unspentNotes: "pos,psk,nullifier",
    spentNotes: "pos,psk,nullifier",
  });

  try {
    localStorage.setItem("lastPos", pos.toString());
    console.log("Set last pos in local storage: " + pos);
  } catch (e) {
    console.error("Cannot set pos in local storage, the wallet will be slow");
  }

  await db.unspentNotes
    .bulkPut(unspentNotes)
    .then(() => {
      console.log("Persisted unspent notes");
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
      console.log("Persisted spent notes");
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
 * @param {string} psk - bs58 encoded public spend key to fetch the unspent notes of
 * @param {Function} callback - function(unspent_notes_array) {}
 * @returns {object} notes - unspent notes of the psk
 */
export async function getUnpsentNotes(psk, callback) {
  const dbHandle = new Dexie("state");

  await dbHandle
    .open()
    .then(async (db) => {
      const myTable = db.table("unspentNotes");

      if (myTable) {
        const notes = myTable.filter((note) => note.psk == psk);

        await notes.toArray().then(async (result) => {
          await callback(result);
        });
      }
    })
    .catch((error) => {
      console.error("Error while getting unspent notes: " + error);
    });
}

/**
 * Fetch spent notes from the IndexedDB if there are any
 * @param {string} psk - bs58 encoded public spend key to fetch the unspent notes of
 * @returns {object} notes-  spent notes of the psk
 */
export async function getSpentNotes(psk, callback) {
  const db = new Dexie("state");

  await db
    .open()
    .then(async (db) => {
      const myTable = db.table("spentNotes");
      if (myTable) {
        const notes = myTable.filter((note) => note.psk == psk);
        await notes.toArray().then(async (result) => {
          await callback(result);
        });
      }
    })
    .catch((error) => {
      console.error("Error while getting spent notes: " + error);
    });
}

/**
 * Fetch lastPos from the localStorage if there is any
 * 0 by default
 * @returns {number} lastPos the position where to fetch from
 */
export function getLastPos() {
  try {
    const lastPos = localStorage.getItem("lastPos");

    if (lastPos == null) {
      console.warn("Last pos is null, need to sync");
      return 0;
    } else {
      try {
        return parseInt(lastPos) + 1;
      } catch (e) {
        console.error("Invalid lastPos set");
        localStorage.removeItem("lastPos");
      }
    }
  } catch (e) {
    console.error(
      "Cannot retrieve lastPos in local storage, the walconst might be slow"
    );
  }
}

/**
 * Fetch all unspent notes from the IndexedDB if there are any
 * @param {Function} callback - function(all_unspent_notes) {}
 */
export async function getAllUnpsentNotes(callback) {
  const db = new Dexie("state");

  await db
    .open()
    .then(async (db) => {
      const myTable = db.table("unspentNotes");
      if (myTable) {
        await myTable.toArray().then(async (result) => {
          await callback(result);
        });
      }
    })
    .catch((error) => {
      console.error("Error while getting all unspent notes: " + error);
    });
}

/**  Delete unspent notes given their Pos and insert spent notes given data
/* @param {Array<number>} unspentNotesPos - ids of the unspent notes to delete
/* @param {Array<object>} spentNotes - spent notes to insert
*/
export async function deleteUnspentNotesInsertSpentNotes(
  unspentNotesPos,
  spentNotes
) {
  const db = new Dexie("state");

  await db
    .open()
    .then(async (db) => {
      const unspentNotesTable = db.table("unspentNotes");
      if (unspentNotesTable) {
        await unspentNotesTable.bulkDelete(unspentNotesPos);
      }

      const spentNotesTable = db.table("spentNotes");

      if (spentNotesTable) {
        await spentNotesTable.bulkPut(spentNotes);
      }
    })
    .catch(Dexie.BulkError, function (e) {
      console.error(
        "Some insert operations did not while deleting unspent notes. " +
          e.failures.length +
          " failures"
      );
    });
}

/**
 * Given bs58 encoded psk, fetch all the spent and unspent notes for that psk
 * @param {string} psk
 * @param {*} callback
 */
export async function getAllNotes(psk, callback) {
  const db = new Dexie("state");

  await db.open().then(async (db) => {
    const unspentNotesTable = db
      .table("unspentNotes")
      .filter((note) => note.psk == psk);
    const spentNotesTable = db
      .table("spentNotes")
      .filter((note) => note.psk == psk);

    await unspentNotesTable.toArray().then(async (unspent) => {
      await spentNotesTable.toArray().then(async (spent) => {
        await callback(spent.concat(unspent));
      });
    });
  });
}
