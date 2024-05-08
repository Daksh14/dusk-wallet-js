// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { encode, parseEncodedJSON } from "./encoding.js";
import { getU64RkyvSerialized, getNullifiersRkyvSerialized } from "./rkyv.js";
import { getPublicKeyRkyvSerialized } from "./keys.js";
import {
  insertSpentUnspentNotes,
  getNextPos,
  correctNotes,
  setLastPos,
  lastPosExists,
} from "./db.js";
import { getOwnedNotes, unspentSpentNotes } from "./crypto.js";
import { path } from "../deps.js";

// env variables
const TRANSFER_CONTRACT = process.env.TRANSFER_CONTRACT;
const NODE = process.env.CURRENT_NODE;
const RKYV_TREE_LEAF_SIZE = process.env.RKYV_TREE_LEAF_SIZE;

// Return a promised rejected if the signal is aborted, resolved otherwise
const abortable = (signal) =>
  new Promise((resolve, rejected) =>
    signal?.aborted ? reject(signal.reason) : resolve(signal),
  );

/**
 *
 * @param {boolean} has_key If the user has the key in the allow list or not
 * @param {boolean} has_staked If the user has staked before
 * @param {number} eligiblity The eligiblity if they have staked
 * @param {number} amount The amount staked
 * @param {number} reward The reward of the stake
 * @param {number} counter The number of transactions done by the user
 * @param {number} epoch The epoch of the stake in the block chain
 */
export function StakeInfo(
  has_key,
  has_staked,
  eligiblity,
  amount,
  reward,
  counter,
  epoch,
) {
  this.has_key = has_key;
  this.has_staked = has_staked;
  this.eligiblity = eligiblity;
  this.amount = amount;
  this.reward = reward;
  this.counter = counter;
  this.epoch = epoch;
}

/**
 * Options for the sync function
 * @typedef {Object} SyncOptions
 * @property {AbortSignal} signal The signal to abort the sync
 * @property {number} from The block height to start syncing from
 */

/**
 * This the most expensive function in this library,
 * This function fetches the notes and then persists them
 * to the indexed DB
 *
 * We then use the notes to calculate balance and perform staking
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed The seed of the walconst
 * @param {SyncOptions} [options] Options for the sync
 * @param {String} [node] The node to sync from
 *
 * @returns {Promise} Promise that resolves when the sync is done
 */
export async function sync(wasm, seed, options = {}, node = NODE) {
  const { signal, from } = options;

  // if the signal is already aborted, we reject the promise before doing
  //  anything
  if (signal?.aborted) {
    throw signal.reason;
    return;
  }

  // our last height where we start fetching from
  // We need to set this number for performance reasons,
  // every invidudal mnemonic walconst has its own last height where it
  // starts to store its notes from
  let position;

  if (typeof from === "number") {
    if (lastPosExists()) {
      throw new Error(
        "Last position already exists, please clear the cache first",
      );
    }
    position = await blockHeightToLastPos(wasm, seed, from, node);
    // persist the provided position retrieved from the block height
    setLastPos(position);
  } else {
    position = getNextPos();
  }

  // Get the leafs from the position above
  const resp = await request(
    await getU64RkyvSerialized(wasm, position),
    "leaves_from_pos",
    true,
    signal,
    node,
  );

  // contains the chunks of the response, at the end of each iteration
  // it conatains the remaining bytes
  let buffer = [];

  for await (const chunk of resp.body) {
    const len = chunk.length;

    for (let i = 0; i < len; i++) {
      buffer.push(chunk[i]);
    }
  }

  const owned = await abortable(signal).then(() =>
    getOwnedNotes(wasm, seed, buffer),
  );
  const notes = owned.notes;
  const nullifiers = owned.nullifiers;
  const psks = owned.public_spend_keys;
  // We use number here because currently wallet-core doesn't know
  // how to parse json with bigInt since there's no specification for BigInt
  //
  // FIXME: We should use bigInt
  //
  // See: <https://github.com/dusk-network/dusk-wallet-js/issues/59>
  const blockHeights = owned.block_heights.split(",").map(Number);
  const lastPos = owned.last_pos;

  const nullifiersSerialized = await abortable(signal).then(() =>
    getNullifiersRkyvSerialized(wasm, nullifiers),
  );

  // Fetch existing nullifiers from the node
  const existingNullifiersBytes = await request(
    nullifiersSerialized,
    "existing_nullifiers",
    false,
    signal,
  ).then(responseBytes);

  const allNotes = await abortable(signal).then(() =>
    unspentSpentNotes(
      wasm,
      notes,
      nullifiers,
      blockHeights,
      existingNullifiersBytes,
      psks,
    ),
  );

  const unspentNotes = Array.from(allNotes.unspent_notes);
  const spentNotes = Array.from(allNotes.spent_notes);

  await abortable(signal).then(() =>
    insertSpentUnspentNotes(unspentNotes, spentNotes, lastPos),
  );

  return correctNotes(wasm);
}
/**
 * By default query the transfer contract unless given otherwise
 * @param {Array<Uint8Array>} data Data that is sent with the request
 * @param {string} request_name Name of the request we are performing
 * @param {boolean} stream If you want the response streamed or not
 * @param {AbortSignal} signal Signal to abort the request
 * @param {string} node Node address, by default CURRENT_NODE
 * @param {string} target target address, by default transfer contract
 * @param {string} targetType the target number in string
 *
 * @returns {Promise<Response>} response Result of the fetch
 */
export function request(
  data,
  request_name,
  stream,
  signal,
  node = NODE,
  target = TRANSFER_CONTRACT,
  targetType = "1",
) {
  const request_name_bytes = encode(request_name);
  const number = u32toLE(request_name.length);
  const length = number.length + request_name_bytes.length + data.length;

  // finalize the bytes we send the node as POST request
  const body = new Uint8Array(length);

  body.set(number, 0);
  body.set(request_name_bytes, number.length);
  body.set(new Uint8Array(data), number.length + request_name_bytes.length);
  const headers = {
    "Content-Type": "application/octet-stream",
    "rusk-version": "0.7.0",
  };

  if (stream) {
    headers["Rusk-Feeder"] = "1";
  }

  const url = new URL(path.join(targetType, target), node);

  return fetch(url, {
    method: "POST",
    headers,
    body,
  });
}

/**
 * Fetch openings from the node
 * @param {number} pos - Position of the note we want the opening of
 * @param {string} node - Node address
 * @returns {Uint8Array} - Bytes of the UInt8Array
 */
export async function fetchOpenings(pos, node = NODE) {
  return responseBytes(await request(pos, "opening", false, undefined, node));
}

/**
 * Fetch the stake info from the network
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} psk
 * @returns {StakeInfo} Info about the stake
 */
export async function stakeInfo(wasm, seed, index) {
  const pk = await getPublicKeyRkyvSerialized(wasm, seed, index);

  const stakeInfoRequest = await responseBytes(
    await request(
      pk,
      "get_stake",
      false,
      undefined,
      undefined,
      process.env.STAKE_CONTRACT,
      "1",
    ),
  );

  const args = {
    stake_info: Array.from(stakeInfoRequest),
  };

  const info = await call(wasm, args, "get_stake_info").then(parseEncodedJSON);

  return new StakeInfo(
    info.has_key,
    info.has_staked,
    info.eligiblity,
    info.amount,
    info.reward,
    info.counter,
    // calculating epoch
    info.eligiblity / 2160,
  );
}

/**
 * Helper function to convert the response into bytes
 * @param {Response} response The response from the fetch api
 * @returns {Promise<Uint8Array>} bytes of the response
 */
export async function responseBytes(response) {
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Helper function to convert a block height to last position
 * @param {Exu.module} wasm
 * @param {Uint8Array} seed
 * @param {number} blockHeight The block height
 * @param {string} [node] The node address
 */
export async function blockHeightToLastPos(
  wasm,
  seed,
  blockHeight,
  node = NODE,
) {
  const resp = await request(
    await getU64RkyvSerialized(wasm, blockHeight),
    "leaves_from_height",
    true,
    undefined,
    node,
  );

  let firstNote = [];

  for await (const chunk of resp.body) {
    firstNote = chunk.slice(0, RKYV_TREE_LEAF_SIZE);

    break;
  }

  const { last_pos } = await getOwnedNotes(wasm, seed, firstNote);

  if (last_pos) {
    // Decrement last pos by one to be safe, its okay to fetch an extra position for
    // correctness reasons
    return last_pos - 1;
  } else {
    return 0;
  }
}

/**
 * Seerialize a number to a little endian byte array
 * @param {number} number to serialize
 * @returns {Uint8Array} the bytes
 */
function u32toLE(num) {
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  view.setUint32(0, num, true);

  return data;
}
