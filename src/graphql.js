// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { request } from "./node.js";
import { toBytes } from "./wasm.js";

/**
 * Query the graphql rusk endpoint
 * @param {string} query graphql query in string
 * @returns {Uint8Array} response
 */
export async function graphQLRequest(query) {
  const bytes = toBytes(query);
  const req = await request(
    bytes,
    "gql",
    false,
    process.env.LOCAL_NODE,
    "Chain",
    "2"
  );

  const buffer = await req.arrayBuffer();
  const response = new Uint8Array(buffer);

  return response;
}

/**
 * Check the status of the transaction on the blockchain
 * @param {string} txid id of the transaction to check the status of
 */
export async function txStatus(txid, callback) {
  await graphQLRequest(`query { tx(hash: "${txid}") { err }}`).then(
    (response) => {
      const json = JSON.parse(new TextDecoder().decode(response));
      callback(json);
    }
  );
}

/**
 * Check for tx hash in the blockchain every 1 seconds for 10 seconds
 * @param {string} txHash the hash of the transaction to wait for
 * @returns {Promise} promise that resolves when the tx is accepted
 */
export function waitTillAccept(txHash) {
  return new Promise((resolve, reject) => {
    let i = 0;

    setInterval(async () => {
      await txStatus(txHash, (status) => {
        i = i + 1;

        if (i > 10) {
          reject("tx was not accepted in 10 seconds");
        }

        const remoteTxStatus = status.tx;
        // keep polling if we don't have a status yet
        if (remoteTxStatus) {
          // if we have an error, reject
          if (remoteTxStatus.err) {
            reject("error in tx: " + status.tx.err);
          } else {
            // this means the tx got accepted
            resolve();
          }
        }
      });
    }, 1000);
  });
}

export async function txHistory() {}
