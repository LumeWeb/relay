import chainNetworks from "./networks.json";

type networks = { [net: string]: string };

export function maybeMapChainId(chain: string): string | boolean {
  if (chain in chainNetworks) {
    return (chainNetworks as networks)[chain];
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
