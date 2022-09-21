#!/bin/bash

rimraf node_modules/libskynetnode/node_modules/node-fetch

for pkg in bcrypto udx-native sodium-native; do
    (
        cd "node_modules/${pkg}" || return
        prebuildify -t "$(node -v)"
        cp "build/Release/obj.target/"*.node "build/Release/"
    )
done
