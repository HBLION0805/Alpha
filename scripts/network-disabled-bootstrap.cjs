"use strict";

if (process.env.ALPHA_NETWORK_DISABLED !== "1") {
  throw new Error("Alpha network guard requires the fixed disabled policy.");
}

const deny = () => {
  throw new Error("Network access is disabled by the Alpha validation policy.");
};

for (const moduleName of [
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "node:dgram",
  "node:dns",
]) {
  const target = require(moduleName);
  for (const key of [
    "request",
    "get",
    "connect",
    "createConnection",
    "createServer",
    "createSocket",
    "lookup",
    "resolve",
    "resolve4",
    "resolve6",
  ]) {
    if (typeof target[key] === "function") target[key] = deny;
  }
}

globalThis.fetch = deny;
globalThis.WebSocket = class DisabledWebSocket {
  constructor() {
    deny();
  }
};
process.env.ALPHA_NETWORK_GUARD_ACTIVE = "1";
