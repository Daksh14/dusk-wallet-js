// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.
/**
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} bytes
 * @returns {number} returns the pointer to the allocated buffer
 */
const alloc = (wasm, bytes) => {
  let length = bytes.byteLength;
  try {
    let ptr = wasm.allocate(length);
    let mem = new Uint8Array(wasm.memory.buffer, ptr, length);

    mem.set(new Uint8Array(bytes));
    return ptr;
  } catch (error) {
    throw new Error("Error allocating memory in wasm: ", +error);
  }
};
/**
 *
 * @param {WebAssembly.Exports} wasm
 * @param result decomposed result of a wasm call
 * @returns {Uint8Array} memory the function allocated
 */
const getAndFree = (wasm, result) => {
  try {
    var mem = new Uint8Array(wasm.memory.buffer, result.ptr, result.length);

    wasm.free_mem(result.ptr, result.length);
    return mem;
  } catch (e) {
    throw new Error("Error while freeing memory: " + e);
  }
};
/**
 * Decompose a i64 output from a call into the packed pointer, length and sucess bit
 * @param result result of a wasm call
 * @returns {object} an object containing ptr, length and status bit
 */
const decompose = (result) => {
  let ptr = result >> 32n;
  let len = ((result << 32n) & ((1n << 64n) - 1n)) >> 48n;
  let success = ((result << 63n) & ((1n << 64n) - 1n)) >> 63n == 0n;

  return {
    ptr: Number(ptr.toString()),
    length: Number(len.toString()),
    status: success,
  };
};
/**
 * encode the string into bytes
 * @param {string} String to convert to bytes
 * @returns {Uint8Array} bytes from the string
 */
export const toBytes = (string) => {
  let utf8Encode = new TextEncoder();
  let bytes = utf8Encode.encode(string);

  return bytes;
};
/**
 * Decode the bytes into string and then json parse it
 * @param {Uint8Array} bytes you want to parse to json
 * @returns {object} Json parsed object
 */
export const jsonFromBytes = (bytes) => {
  let string = new TextDecoder().decode(bytes);
  let jsonParsed = JSON.parse(string);

  return jsonParsed;
};
/**
 * Perform a wasm function call
 * @param {WebAssembly.Exports} wasm
 * @param {object} args Arguments of the function in JSON
 * @param {WebAssembly.ExportValue} function_call name of the function you want to call
 */
export const call = (wasm, args, function_call) => {
  let argBytes = toBytes(args);

  // allocate the json we want to send to wallet-core
  let ptr = alloc(wasm, argBytes);
  let call = function_call(ptr, argBytes.byteLength);
  let callResult = decompose(call);

  if (!callResult.status) {
    console.error("Function call " + function_call + " failed!");
  }
  let bytes = getAndFree(wasm, callResult);
  // convert to json
  let jsonResponse = jsonFromBytes(bytes);

  return jsonResponse;
};
/**
 * get the tree leaf from leaf the node sent us, deserialized
 * into notes and block height
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} leaf bytes you get from the node
 * @returns {object} json serialized bytes of leaf (note and height)
 */
export const getTreeLeafDeserialized = (wasm, leaf) => {
  // we want to send the data in json to wallet-core
  let json = JSON.stringify({
    bytes: Array.from(leaf),
  });

  let treeLeaf = call(wasm, json, wasm.rkyv_tree_leaf);

  return treeLeaf;
};
/**
 * Convert a number to rkyv serialized bytes
 * @param {WebAssembly.Exports} wasm
 * @param {number} number we want to rkyv serialize
 * @returns {Uint8Array} rkyv serialized bytes of the u64
 */
export const getU64RkyvSerialized = (wasm, num) => {
  let jsonBytes = toBytes(
    JSON.stringify({
      value: num,
    })
  );

  let ptr = alloc(wasm, jsonBytes);
  let call = wasm.rkyv_u64(ptr, jsonBytes.byteLength);
  let callResult = decompose(call);
  let bytes = getAndFree(wasm, callResult);

  return bytes;
};
