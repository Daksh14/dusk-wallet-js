// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { readableStreamFromReader as toStream } from "https://deno.land/std@0.136.0/streams/conversion.ts";

/**
 * Asynchronously creates a response object with a specified maximum number of items.
 *
 * @param {number} maxItems - The maximum number of items to include in the response.
 * @returns {Promise<Response>} A promise that resolves to a Response object.
 */
export const createResponse = async (maxItems) => {
  // Open the file "tests/notes.rkyv" and convert it to a stream
  let response = new Response(toStream(await Deno.open("tests/notes.rkyv")));

  // If maxItems is a number, adjust the response to include only a portion of the buffer
  if (typeof maxItems === "number") {
    // Convert the response to an ArrayBuffer
    const buffer = await response.arrayBuffer();
    // Slice the buffer to include only the specified number of items (632 bytes per item)
    response = new Response(buffer.slice(0, 632 * maxItems));
  }

  // Return the modified or original response
  return response;
};

/**
 * Wraps a function with a mocked fetch implementation.
 *
 * @param {Function} fn - The function to wrap with mocked fetch.
 * @param {Object} mockOptions - Options to configure the mock behavior.
 * @param {number} [mockOptions.maxItems] - The maximum number of items for the mocked response.
 * @param {AbortController} [mockOptions.controller] - Controller to abort the signal before provide the mocked response, if provided.
 * @returns {Function} A function that, when called, executes the wrapped function with mocked fetch.
 */
export function withMockedFetch(fn, mockOptions = {}) {
  return async function () {
    // Store the original fetch function
    const oldFetch = globalThis.fetch;

    // Override the global fetch function with a custom implementation
    globalThis.fetch = async function (url, options) {
      // Check if the request has the custom header "Rusk-Feeder",
      // since only those requests should be mocked (fetching notes
      // from the rusk node)
      if (options?.headers?.["Rusk-Feeder"] === "1") {
        if (mockOptions.controller) {
          mockOptions.controller.abort();
        }

        if (options.signal?.aborted) {
          return Promise.reject(options.signal.reason);
        }

        // Return a custom response created with the specified maxItems
        return createResponse(mockOptions.maxItems);
      } else {
        // Fall back to the original fetch function
        return oldFetch(url, options);
      }
    };

    try {
      // Execute the provided function and return its result
      return await fn();
    } finally {
      // Restore the original fetch function
      globalThis.fetch = oldFetch;
    }
  };
}
