// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { router, serve } from "./httpserver.decorator.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;

let appPort = DEFAULT_DAPR_APP_PORT;
let daprPort = Deno.env.get("DAPR_HTTP_PORT") ?? DEFAULT_DAPR_HTTP_PORT;

interface SubscriptionData {
  pubSubName: string;
  topic: string;
  route?: string;
  metadata?: {
    rawPayload: "true" | "false";
  };
}

const subscriptions: SubscriptionData[] = [];

export const Subscribe = (
  subscription: SubscriptionData,
): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    subscription.route ??= subscription.topic;
    router.add(
      "POST",
      `/${subscription.route}`,
      async ({ request }: { request: Request }) => {
        descriptor.value(await request.json());
        return HTTP_RESPONSE_200;
      },
    );
    subscriptions.push(subscription);
  };

export const Bind = (
  name: string,
): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    router.add(
      "OPTIONS",
      `/${name}`,
      () => HTTP_RESPONSE_200,
    );
    router.add(
      "POST",
      `/${name}`,
      async ({ request }: { request: Request }) => {
        descriptor.value(await request.json());
        return HTTP_RESPONSE_200;
      },
    );
  };

export interface PublishData {
  pubSubName: string;
  topic: string;
  data: any;
  metadata?: {
    ttlInSeconds?: number;
    rawPayload?: "true" | "false";
  };
}

export const publish = async (options: PublishData) => {
  // deno-fmt-ignore
  const url = `http://localhost:${daprPort}/v1.0/publish/${options.pubSubName}/${options.topic}` + (options.metadata ? ("?" + new URLSearchParams(options.metadata as any).toString()): "");
  return fetch(
    url,
    { method: "POST", body: JSON.stringify(options.data) },
  );
};

interface BindingData {
  name: string;
  data?: any;
  metadata?: {};
  operation?: string;
}

export const binding = async (options: BindingData) => {
  // deno-fmt-ignore
  const url = `http://localhost:${daprPort}/v1.0/bindings/${options.name}`;
  return fetch(
    url,
    { method: "POST", body: JSON.stringify({ ...options }) },
  );
};

interface startOptions {
  appPort?: number;
  controllers: Function[];
}

export const start = (options: startOptions) => {
  appPort = options.appPort ?? DEFAULT_DAPR_APP_PORT;
  router.add("GET", "/dapr/subscribe", () => {
    return {
      body: JSON.stringify(subscriptions),
      init: { headers: { "content-type": "application/*+json" } },
    };
  });
  serve({ port: appPort, controllers: options.controllers });
};
