go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
go install github.com/mikefarah/yq/yq@latest

yq -i ".version=\"${1}\"" nfpm.yaml
nfpm package -p deb
pip install --upgrade cloudsmith-cli
cloudsmith push deb lumeweb/lume-web-relay *.deb
