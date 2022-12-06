#!/bin/bash

for pkg in udx-native sodium-native; do
    (
        cd "node_modules/${pkg}" || return
        prebuildify -t "$(node -v)"
        cp "build/Release/obj.target/"*.node "build/Release/"
    )
done
