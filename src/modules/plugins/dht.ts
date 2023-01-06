import { Plugin, PluginAPI } from "@lumeweb/relay-types";
import { getRpcServer } from "../rpc/server";
import b4a from "b4a";

const plugin: Plugin = {
  name: "dht",
  async plugin(api: PluginAPI): Promise<void> {
    api.registerMethod("join_topic", {
      cacheable: false,
      async handler(topic: string): Promise<void> {
        if (!api.swarm._discovery.has(topic)) {
          api.swarm.join(topic);
        }
      },
    });
    api.registerMethod("get_topic_peers", {
      cacheable: false,
      async handler(topic: string): Promise<string[]> {
        return [...api.swarm.peers.values()]
          .filter((peerInfo) => peerInfo._seenTopics.has(topic))
          .map((peerInfo) => b4a.from(peerInfo.publicKey).toString());
      },
    });

    api.registerMethod("get_topics", {
      cacheable: false,
      async handler(): Promise<string[]> {
        return [...api.swarm.peers.keys()];
      },
    });
  },
};

export default plugin;
