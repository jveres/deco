// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Http } from "./httpserver.decorator.ts";
import { stringFromPropertyKey } from "../utils/utils.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";
import { getMetadata, setMetadata } from "./metadata.decorator.ts";
import { HttpMethod } from "../utils/Router.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;
export const DAPR_HTTP_PORT = Deno.env.get("DAPR_HTTP_PORT") ??
  DEFAULT_DAPR_HTTP_PORT;

type Metadata = Record<string, string>;

export class Service {
  static expose({ serviceName, method = "GET" }: {
    serviceName?: string;
    method?: HttpMethod;
  } = {}): MethodDecorator {
    {
      return (
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<any>,
      ): void => {
        serviceName ??= stringFromPropertyKey(propertyKey);
        Http.Route({ method, path: `/${serviceName}` })(
          target,
          propertyKey,
          descriptor,
        );
      };
    }
  }

  static async invoke(
    { appId, method, data }: { appId: string; method: string; data?: any },
  ): Promise<Response> {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/invoke/${appId}/method/${method}`;
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      },
    );
    if (res.status === 200) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Service.invoke(): appId="${appId}", method="${method}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }
}

export class PubSub {
  static readonly PUBSUBNAME_KEY = "__pubsubname__";
  static readonly SUBSCRIPTIONS_KEY = "__subscriptions__";

  static subscribeTo(
    { pubSubName, topicName, route, metadata }: {
      pubSubName?: string;
      topicName?: string;
      route?: string;
      metadata?: Metadata;
    } = {},
  ): MethodDecorator {
    return (
      target: Object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      topicName ??= stringFromPropertyKey(propertyKey);
      route ??= topicName;
      const subscriptions = getMetadata<object[]>(
        target,
        PubSub.SUBSCRIPTIONS_KEY,
        [],
      );
      subscriptions.push({
        pubSubName,
        topicName,
        route,
        metadata,
        handler: descriptor.value,
      });
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method: "POST",
        path: `/${route}`,
        handler: async function ({ request }: { request: Request }) {
          await descriptor.value.apply(this, [await request.json()]);
          return HTTP_RESPONSE_200;
        },
      });
    };
  }

  static async publish(
    { pubSubName, topicName, data, metadata }: {
      pubSubName: string;
      topicName: string;
      data: any;
      metadata?: Metadata;
    },
  ): Promise<Response> {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/publish/${pubSubName}/${topicName}` +
      (metadata ? ("?" + new URLSearchParams(metadata).toString()) : "");
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      },
    );
    if (res.status === 204) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during PubSub.publish(): pubSubName="${pubSubName}", topic="${topicName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }
}

export class Bindings {
  static invoke({ bindingName, data, metadata, operation }: {
    bindingName: string;
    data?: any;
    metadata?: Metadata;
    operation?: string;
  }) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/bindings/${bindingName}`;
    if (operation) operation = operation.toLowerCase();
    return fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify({
          data,
          ...metadata && { metadata },
          ...operation && { operation },
        }),
        headers: { "content-type": "application/json" },
      },
    );
  }

  static listenTo({ bindingName }: {
    bindingName?: string;
  } = {}): MethodDecorator {
    return (
      target: Object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      bindingName ??= stringFromPropertyKey(propertyKey);
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method: "OPTIONS",
        path: `/${bindingName}`,
        handler: () => HTTP_RESPONSE_200,
      });
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method: "POST",
        path: `/${bindingName}`,
        handler: async function ({ request }: { request: Request }) {
          await descriptor.value.apply(this, [await request.json()]);
          return HTTP_RESPONSE_200;
        },
      });
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
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/secrets/${store}/${key}` +
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
    const url = `http://localhost:${DAPR_HTTP_PORT}/v1.0/secrets/${store}/bulk`;
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

type StateConsistency = "eventual" | "strong";
type StateConcurrency = "first-write" | "last-write";
type ETag = string;

interface StateObject {
  key: string;
  value: any;
  etag?: ETag;
  metadata?: Metadata;
  options?: {
    "concurrency": StateConcurrency;
    "consistency": StateConsistency;
  };
}

export class State {
  static async set(
    { storename, data }: { storename: string; data: StateObject[] },
  ) {
    const url = `http://localhost:${DAPR_HTTP_PORT}/v1.0/state/${storename}`;
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      },
    );
    if (res.status === 204) return res;
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
    consistency?: StateConsistency;
    metadata?: Metadata;
  }) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/state/${storename}/${key}` +
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
    if (res.status === 200) return await res.text();
    else if (res.status === 204) return undefined;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during State.get(): storename="${storename}", key="${key}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async getBulk({ storename, data, metadata }: {
    storename: string;
    data: any;
    metadata?: Metadata;
  }) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/state/${storename}/bulk` +
      (metadata
        ? ("?" + new URLSearchParams(prepMetadata(metadata)).toString())
        : "");
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      },
    );
    if (res.status === 200) return await res.json();
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
  static AppController(
    { pubSubName }: { pubSubName?: string } = {},
  ): ClassDecorator {
    return (target: Function): void => {
      setMetadata(target.prototype, PubSub.PUBSUBNAME_KEY, pubSubName);
    };
  }

  static start(
    { appPort = DEFAULT_DAPR_APP_PORT, controllers }: {
      appPort?: number;
      controllers: Function[];
    },
  ) {
    // Initialize controllers
    const subscribe: object[] = [];
    for (const controller of controllers) {
      const subscriptions = getMetadata<Record<string, any>[]>(
        controller.prototype,
        PubSub.SUBSCRIPTIONS_KEY,
      );
      if (subscriptions && subscriptions.length > 0) {
        const pubSubName = getMetadata<string>(
          controller.prototype,
          PubSub.PUBSUBNAME_KEY,
        );
        subscriptions.map((subscription) => {
          const pubsubname = subscription.pubSubName || pubSubName;
          if (!pubsubname) throw Error(`Dapr.start(): missing pubSubName`);
          subscribe.push(Object.assign({}, {
            pubsubname,
            topic: subscription.topicName,
            route: subscription.route,
            ...subscription.metadata && { metadata: subscription.metadata },
          }));
        });
      }
    }
    // Register PubSub subscriptions
    if (subscribe.length > 0) {
      Http.router.add({
        method: "GET",
        path: "/dapr/subscribe",
        action: {
          handler: () => {
            return {
              body: JSON.stringify(subscribe),
              init: { headers: { "content-type": "application/*+json" } },
            };
          },
        },
      });
    }
    // Start Http server
    Http.serve({ port: appPort, controllers });
  }
}
