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

interface PubSubSubscription {
  pubSubName: string;
  topic: string;
  route?: string;
  metadata?: Metadata;
}

export class PubSub {
  static readonly subscriptions: PubSubSubscription[] = [];

  static subscribe(
    subscriptions: PubSubSubscription,
  ): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      subscriptions.route ??= subscriptions.topic; // TODO: slugify
      Http.router.add(
        {
          method: "POST",
          path: `/${subscriptions.route}`,
          action: {
            handler: async ({ request }: { request: Request }) => {
              descriptor.value(await request.json());
              return HTTP_RESPONSE_200;
            },
            target: target.constructor,
          },
        },
      );
      PubSub.subscriptions.push(subscriptions);
    };
  }

  static async publish(
    { pubSubName, topic, data, metadata }: {
      pubSubName: string;
      topic: string;
      data: any;
      metadata?: Metadata;
    },
  ) {
    const url =
      `http://localhost:${daprPort}/v1.0/publish/${pubSubName}/${topic}` +
      (metadata ? ("?" + new URLSearchParams(metadata).toString()) : "");
    const res = await fetch(
      url,
      { method: "POST", body: JSON.stringify(data) },
    );
    if (res.status === 204) return;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during PubSub.publish(): pubSubName="${pubSubName}", topic="${topic}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }
}

export class Bindings {
  static invoke({ name, data, metadata, operation }: {
    name: string;
    data?: any;
    metadata?: Metadata;
    operation?: string;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/bindings/${name}`;
    return fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify({
          data,
          ...metadata && { metadata },
          ...operation && { operation },
        }),
      },
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

export class Secrets {
  static async get(
    { store, key, metadata }: {
      store: string;
      key: string;
      metadata?: Metadata;
    },
  ) {
    const url = `http://localhost:${daprPort}/v1.0/secrets/${store}/${key}` +
      (metadata ? ("?" + new URLSearchParams(metadata).toString()) : "");
    const res = await fetch(url);
    if (res.status === 200) {
      const secret = await res.json();
      return secret[key];
    } else {
      const { status, statusText } = res;
      throw Error(
        `Error during Secrets.get(): store="${store}", key="${key}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async getBulk({ store }: {
    store: string;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/secrets/${store}/bulk`;
    const res = await fetch(url);
    if (res.status === 200) {
      const ret: Record<string, string> = {};
      const secrets = await res.json();
      for (const key in secrets) {
        ret[key] = secrets[key][key];
      }
      return ret;
    } else {
      const { status, statusText } = res;
      throw Error(
        `Error during Secrets.getBulk(): store="${store}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }
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

export class State {
  static async set(
    { storename, data }: { storename: string; data: StateObject[] },
  ) {
    const url = `http://localhost:${daprPort}/v1.0/state/${storename}`;
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "content-type": "application/json",
        },
      },
    );
    if (res.status === 204) return;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during State.set(): storename="${storename}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async get({ storename, key, consistency, metadata }: {
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
    const res = await fetch(url);
    if (res.status === 200) return res.json();
    else {
      const { status, statusText } = res;
      if (status === 204) return;
      else {
        throw Error(
          `Error during State.get(): storename="${storename}", key="${key}", code=${status}, text="${statusText}"`,
          { cause: { status, statusText } },
        );
      }
    }
  }

  static async getBulk({ storename, data, metadata }: {
    storename: string;
    data: any;
    metadata?: Metadata;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/state/${storename}/bulk` +
      (metadata
        ? ("?" + new URLSearchParams(prepMetadata(metadata)).toString())
        : "");
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "content-type": "application/json",
        },
      },
    );
    if (res.status === 200) return res.json();
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during State.getBulk(): storename="${storename}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
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
