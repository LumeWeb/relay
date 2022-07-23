export function errorExit(msg: string): void {
  console.error(msg);
  process.exit(1);
}

export const ERR_NOT_READY = "NOT_READY";
