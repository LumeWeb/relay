#!/bin/bash

if ! command -v go &>/dev/null; then
    sudo apt-get update && sudo apt-get install -y golang
fi

sudo go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
sudo chmod +x /root/go/bin/nfpm

yq -i ".version=\"${1}\"" nfpm.yaml
sudo /root/go/bin/nfpm package -p deb

if ! command -v pip &>/dev/null; then
    sudo apt-get update && sudo apt-get install -y python-pip
fi

pip2 install --upgrade cloudsmith-cli
cloudsmith push deb lumeweb/lume-web-relay *.deb
