// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { execute } from "./execute.js";

export async function transfer(wasm, seed, sender, receiver, amount) {
  let output = {
    receiver: receiver,
    note_type: "Obfuscated",
    ref_id: 1,
    value: amount,
  };

  execute(wasm, seed, sender, output, undefined, undefined, 500000000, 1);
}
