let chainNetworks: networks;

dynImport("@lumeweb/pokt-rpc-endpoints").then(
  (module) => (chainNetworks = module as any)
);

type networks = { [net: string]: string };

export function maybeMapChainId(chain: string): string | boolean {
  if (chain in chainNetworks) {
    return chainNetworks[chain];
  }

  if (
    [parseInt(chain, 16).toString(), parseInt(chain, 10).toString()].includes(
      chain.toLowerCase()
    )
  ) {
    return chain;
  }

  return false;
}

export function reverseMapChainId(chainId: string): string | boolean {
  let vals = Object.values(chainNetworks);
  if (!vals.includes(chainId)) {
    return false;
  }

  return Object.keys(chainNetworks)[vals.indexOf(chainId)];
}

export function isIp(ip: string) {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    ip
  );
}

export function dynImport(module: string) {
  return Function(`return import("${module}")`)() as Promise<any>;
}
