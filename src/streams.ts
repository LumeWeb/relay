function idFactory(start = 1, step = 1, limit = 2 ** 32) {
  let id = start;

  return function nextId() {
    const nextId = id;
    id += step;
    if (id >= limit) id = start;
    return nextId;
  };
}

export interface StreamFileResponse {
  data?: Uint8Array;
  done: boolean;
}

const nextId = idFactory(1);
const streams = new Map<number, AsyncIterable<Uint8Array>>();

export function getStream(id: number): AsyncIterable<Uint8Array> | boolean {
  if (!streams.has(id)) {
    return false;
  }

  return streams.get(id) as AsyncIterable<Uint8Array>;
}

export function addStream(stream: AsyncIterable<Uint8Array>): number {
  const id = nextId();
  streams.set(id, stream);

  return id;
}
