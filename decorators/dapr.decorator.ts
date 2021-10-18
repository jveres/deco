// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Newable, router, serve } from "./httpserver.decorator.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;

let appPort = DEFAULT_DAPR_APP_PORT;
const daprPort = Deno.env.get("DAPR_HTTP_PORT") ?? DEFAULT_DAPR_HTTP_PORT;

interface PubSubSubscriptionConfig {
  pubSubName: string;
  topic: string;
  route?: string;
  metadata?: {
    rawPayload: "true" | "false";
  };
}

const PUBSUB_SUBSCRIPTIONS: PubSubSubscriptionConfig[] = [];

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
  static publish = (config: PubSubPublishConfig) => {
    // deno-fmt-ignore
    const url = `http://localhost:${daprPort}/v1.0/publish/${config.pubSubName}/${config.topic}` + (config.metadata ? ("?" + new URLSearchParams(config.metadata as any).toString()): "");
    return fetch(
      url,
      { method: "POST", body: JSON.stringify(config.data) },
    );
  };

  static Subscribe = (
    config: PubSubSubscriptionConfig,
  ): MethodDecorator =>
    (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      config.route ??= config.topic; // TODO: slugify
      router.add(
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
      PUBSUB_SUBSCRIPTIONS.push(config);
    };
}

interface BindingInvocationConfig {
  name: string;
  data?: any;
  metadata?: {};
  operation?: string;
}

export class Bindings {
  static invoke(config: BindingInvocationConfig) {
    // deno-fmt-ignore
    const url = `http://localhost:${daprPort}/v1.0/bindings/${config.name}`;
    return fetch(
      url,
      { method: "POST", body: JSON.stringify({ ...config }) },
    );
  }

  static BindTo = (
    name: string,
  ): MethodDecorator =>
    (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      router.add(
        {
          method: "OPTIONS",
          path: `/${name}`,
          action: {
            handler: () => HTTP_RESPONSE_200,
            target: target.constructor,
          },
        },
      );
      router.add(
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

interface SecretsGetMetadata extends Record<string, any> {
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

  static async getAll(
    store: string,
  ) {
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

interface startOptions {
  appPort?: number;
  controllers: Newable<any>[];
}

export const start = (options: startOptions) => {
  appPort = options.appPort ?? DEFAULT_DAPR_APP_PORT;
  if (PUBSUB_SUBSCRIPTIONS.length > 0) { // TODO: move out to a function
    router.add({
      method: "GET",
      path: "/dapr/subscribe",
      action: {
        handler: () => {
          return {
            body: JSON.stringify(PUBSUB_SUBSCRIPTIONS),
            init: { headers: { "content-type": "application/*+json" } },
          };
        },
      },
    });
  }
  serve({ port: appPort, controllers: options.controllers });
};
