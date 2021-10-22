// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Http } from "./httpserver.decorator.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;
export const daprPort = Deno.env.get("DAPR_HTTP_PORT") ??
  DEFAULT_DAPR_HTTP_PORT;

export type Consistency = "eventual" | "strong";
export type Concurrency = "first-write" | "last-write";
export type Metadata = Record<string, string>;
export type ETag = string;

interface PubSubSubscriptionConfig {
  pubSubName: string;
  topic: string;
  route?: string;
  metadata?: {
    rawPayload: "true" | "false";
  };
}

export interface PubSubPublishConfig {
  pubSubName: string;
  topic: string;
  data: any;
  metadata?: {
    ttlInSeconds?: number;
    rawPayload?: "true" | "false";
  };
}

export class PubSub {
  static readonly subscriptions: PubSubSubscriptionConfig[] = [];

  static publish(config: PubSubPublishConfig) {
    const url =
      `http://localhost:${daprPort}/v1.0/publish/${config.pubSubName}/${config.topic}` +
      (config.metadata
        ? ("?" + new URLSearchParams(config.metadata as Metadata).toString())
        : "");
    return fetch(
      url,
      { method: "POST", body: JSON.stringify(config.data) },
    );
  }

  static subscribe(
    config: PubSubSubscriptionConfig,
  ): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      config.route ??= config.topic; // TODO: slugify
      Http.router.add(
        {
          method: "POST",
          path: `/${config.route}`,
          action: {
            handler: async ({ request }: { request: Request }) => {
              descriptor.value(await request.json());
              return HTTP_RESPONSE_200;
            },
            target: target.constructor,
          },
        },
      );
      PubSub.subscriptions.push(config);
    };
  }
}

interface BindingInvocationConfig {
  name: string;
  data?: any;
  metadata?: Metadata;
  operation?: string;
}

export class Bindings {
  static invoke(config: BindingInvocationConfig) {
    const url = `http://localhost:${daprPort}/v1.0/bindings/${config.name}`;
    return fetch(
      url,
      { method: "POST", body: JSON.stringify({ ...config }) },
    );
  }

  static listenTo({ name }: {
    name: string;
  }): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      Http.router.add(
        {
          method: "OPTIONS",
          path: `/${name}`,
          action: {
            handler: () => HTTP_RESPONSE_200,
            target: target.constructor,
          },
        },
      );
      Http.router.add(
        {
          method: "POST",
          path: `/${name}`,
          action: {
            handler: async ({ request }: { request: Request }) => {
              descriptor.value(await request.json());
              return HTTP_RESPONSE_200;
            },
            target: target.constructor,
          },
        },
      );
    };
  }
}

interface SecretsGetMetadata extends Metadata {
  // deno-lint-ignore camelcase
  version_id: string;
}

export class Secrets {
  static async get(
    { store, key, metadata }: {
      store: string;
      key: string;
      metadata?: SecretsGetMetadata;
    },
  ) {
    const url = `http://localhost:${daprPort}/v1.0/secrets/${store}/${key}` +
      (metadata ? ("?" + new URLSearchParams(metadata).toString()) : "");
    const res = await fetch(url);
    let ret = undefined;
    if (res.status === 200) {
      const secret = await res.json();
      ret = secret[key];
    }
    return ret;
  }

  static async getAll({ store }: {
    store: string;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/secrets/${store}/bulk`;
    const res = await fetch(url);
    const ret: Record<string, string> = {};
    if (res.status === 200) {
      const secrets = await res.json();
      for (const key in secrets) {
        ret[key] = secrets[key][key];
      }
    }
    return ret;
  }
}

interface StateObject {
  key: string;
  value: any;
  etag?: ETag;
  metadata?: Metadata;
  options?: {
    "concurrency": Concurrency;
    "consistency": Consistency;
  };
}

const prepMetadata = (
  metadata: Metadata,
  prepWith = "metadata",
) => {
  const ret: Metadata = {};
  Object.keys(metadata).map((key: string) => {
    ret[`${prepWith}.${key}`] = metadata[key];
  });
  return ret;
};

export class State {
  static set(
    { storename, data }: { storename: string; data: StateObject[] },
  ) {
    const url = `http://localhost:${daprPort}/v1.0/state/${storename}`;
    return fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }

  static get({ storename, key, consistency, metadata }: {
    storename: string;
    key: string;
    consistency?: Consistency;
    metadata?: Metadata;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/state/${storename}/${key}` +
      (consistency || metadata
        ? ("?" +
          new URLSearchParams(
            {
              ...metadata && prepMetadata(metadata),
              ...consistency && { consistency },
            } as Metadata,
          ).toString())
        : "");
    return fetch(url);
  }

  static getAll({ storename, data, metadata }: {
    storename: string;
    data: any;
    metadata?: Metadata;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/state/${storename}/bulk` +
      (metadata
        ? ("?" + new URLSearchParams(prepMetadata(metadata)).toString())
        : "");
    return fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }
}

export class Dapr {
  static start({ appPort }: { appPort?: number } = {}) {
    appPort ??= DEFAULT_DAPR_APP_PORT;
    if (PubSub.subscriptions.length > 0) { // TODO: move out to a function
      Http.router.add({
        method: "GET",
        path: "/dapr/subscribe",
        action: {
          handler: () => {
            return {
              body: JSON.stringify(PubSub.subscriptions),
              init: { headers: { "content-type": "application/*+json" } },
            };
          },
        },
      });
    }
    Http.serve({ port: appPort });
  }
}
