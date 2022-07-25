#!/bin/bash

rimraf node_modules/@tendermint/types
rimraf node_modules/@pokt-network/amino-js/node_modules/@tendermint/belt/types
rimraf node_modules/@pokt-network/amino-js/node_modules/@tendermint/belt/src
rimraf node_modules/@pokt-network/amino-js/node_modules/@tendermint/belt/index.ts
rimraf node_modules/@pokt-network/amino-js/node_modules/@tendermint/belt/dist/web*
rimraf node_modules/@tendermint/belt/types
rimraf node_modules/@tendermint/belt/node_modules/@tendermint/types
rimraf node_modules/@pokt-network/pocket-js/dist/web.js
rimraf node_modules/@pokt-network/amino-js/dist/web*
rimraf node_modules/supports-color
rimraf node_modules/*/node_modules/loady

for pkg in bcrypto udx-native secp256k1 bigint-buffer bufferutil sodium-native bdb goosig mrmr utf-8-validate; do
    (
        cd "node_modules/${pkg}" || return
        prebuildify -t "$(node -v)"
        cp "build/Release/obj.target/"*.node "build/Release/"
    )
done
