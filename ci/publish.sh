#!/bin/bash

if ! command -v go &>/dev/null; then
    sudo apt-get update && sudo apt-get install -y golang
fi

go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest

yq -i ".version=\"${1}\"" nfpm.yaml
nfpm package -p deb
pip install --upgrade cloudsmith-cli
cloudsmith push deb lumeweb/lume-web-relay *.deb
