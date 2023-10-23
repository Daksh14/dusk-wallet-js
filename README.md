# dusk-wallet-js
JavaScript library for rusk-wallet

This will be later grafted into js-utils repo

# Guide to use

## Bundling
```
➜ deno task build
```
This will create a `dist/wallet.js` which can be used on the frontend side

## Usage 

```html
<script type="module">
  import { Wallet } from "../dist/wallet.js";
  const initWasm = async () => {
    // load a wallet wasm
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch("../assets/dusk-wallet-core-0.21.0.wasm"),
    );

    let wasm = instance.exports;
    // generate random mnemonic for users
    let mnemonic = generateRandomMnemonic(wasm);
    // Default wallet seed
    let seed = [
      153, 16, 102, 99, 133, 196, 55, 237, 42, 2, 163, 116, 233, 89, 10, 115,
      19, 81, 140, 31, 38, 81, 10, 46, 118, 112, 151, 244, 145, 90, 145, 168,
      214, 242, 68, 123, 116, 76, 223, 56, 200, 60, 188, 217, 34, 113, 55, 172,
      27, 255, 184, 55, 143, 233, 109, 20, 137, 34, 20, 196, 252, 117, 221, 221,
    ];
    let wallet = new Wallet(wasm, seed);
    // get the 21 psks that belongs to the wallet
    let psks = wallet.getPsks();
    // sync the wallet using IndexedDB, everything is managed internally
    let sync = await wallet.sync();
    // get balance for the first public spend key
    let balance = wallet.getBalance(psks[0], (bal) => {
      console.log(bal.value);
    });
  };

  document.addEventListener("DOMContentLoaded", function (event) {
    initWasm().catch((e) => console.error(e));
  });
</script>
```

## Syncronization
To sync with the latest notes, call the `Wallet.sync()`. It saves the state in indexedDB and localstorage
it will log the console.error if localstorage or indexedDB is `undefined`

## Operations
After the sync is done and latest state is in the db, you can call 
`Wallet.getBalance()` and calculate the balance with `spendable` and `value` as fields

## Tx history
run the wallet.getSpentNotes()

## Testing
Add integration test against a local node. Figure out how to run that in CI

To run the example first build and then
```
➜ deno task server
```
