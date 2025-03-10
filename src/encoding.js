// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/**
 * Encodes the string given as Uint8Array.
 *
 * @param {string} String to encode
 * @returns {Uint8Array}
 */
export const encode = (string) => encoder.encode(string);

/**
 * Decodes the given Uint8Array
 *
 * @param {Uint8Array} Buffer to decode
 * @returns {String}
 */
export const decode = (buffer, options) => decoder.decode(buffer, options);

/**
 * Decodes the given Uint8Array and parses it as JSON
 *
 * @param {Uint8Array} Buffer to decode
 * @param {Function} [reviver] Optional reviver function
 *
 * @returns {Object}
 */
export const parseEncodedJSON = (buffer, reviever) =>
  JSON.parse(decode(buffer), reviever);

/**
 * Converts a JavaScript value to a JSON string, optionally replacing values
 * if a replacer function is specified or optionally including only the specified
 * properties if a replacer array is specified.
 *
 * @param {any} value
 * @param {Function} [replacer]
 * @param {string|Number} [space]
 *
 * @returns {string}
 */
export const encodeStringifiedValue = (value, replacer, space) =>
  encode(JSON.stringify(value, replacer, space));
