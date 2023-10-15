/**
 *
 * @param {WebAssembly.Exports} wasmExports
 * @param {wasmExports.allocate} Wasm export to allocate a buffer
 * @param {Uint8Array} bytes
 * @returns {number} returns the pointer to the allocated buffer
 */
const alloc = (wasmExports, bytes) => {
  let length = bytes.byteLength;
  try {
    let ptr = wasmExports.allocate(length);
    let mem = new Uint8Array(wasmExports.memory.buffer, ptr, length);

    mem.set(new Uint8Array(bytes));
    return ptr;
  } catch (error) {
    throw new Error("Error allocating memory in wasm: ", +error);
  }
};
/**
 *
 * @param {*} wasmExports
 * @param result decomposed result of a wasm call
 * @returns {Uint8Array} memory the function allocated
 */
const getAndFree = (wasmExports, result) => {
  try {
    var mem = new Uint8Array(
      wasmExports.memory.buffer,
      result.ptr,
      result.length
    );

    wasmExports.free_mem(result.ptr, result.length);
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
 */
const jsonFromBytes = (bytes) => {
  let string = new TextDecoder().decode(bytes);
  let json_parsed = JSON.parse(string);
  return json_parsed;
};
/**
 * get the tree leaf from leaf the node sent us
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} leaf bytes you get from the node
 * @returns {object} json serialized bytes of leaf (note and height)
 */
const getTreeLeafSerialized = (wasmExports, leaf) => {
  // we want to send the data in json to wallet-core
  let json = JSON.stringify({
    bytes: Array.from(leaf),
  });
  let json_bytes = toBytes(json);
  // allocate the json we want to send to wallet-core
  let ptr = alloc(wasm, json_bytes);
  // get it serialized
  let call = wasmExports.rkyv_tree_leaf(ptr, json_bytes.byteLength);
  let callResult = decompose(call);
  let bytes = getAndFree(wasm, callResult);
  // convert to json
  let treeLeaf = jsonFromBytes(bytes);

  return treeLeaf;
};
