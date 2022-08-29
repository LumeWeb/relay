export function dynImport(module: string) {
  return Function(`return import("${module}")`)() as Promise<any>;
}
