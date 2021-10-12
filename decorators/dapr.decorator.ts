// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import * as Http from "./httpserver.decorator.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;

interface Subscription {
  pubSubName: string;
  topic: string;
  route?: string;
  metadata?: {};
}

const subscriptions: Subscription[] = [];

export const Subscribe = (
  subscription: Subscription,
): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    subscription.route ??= subscription.topic;
    Http.router.add(
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
    Http.router.add(
      "OPTIONS",
      `/${name}`,
      () => HTTP_RESPONSE_200,
    );
    Http.router.add(
      "POST",
      `/${name}`,
      async ({ request }: { request: Request }) => {
        descriptor.value(await request.json());
        return HTTP_RESPONSE_200
      },
    );
  };

export const start = (controllers: Function[]) => {
  Http.router.add("GET", "/dapr/subscribe", () => {
    return {
      body: JSON.stringify(subscriptions),
      init: { headers: { "content-type": "application/*+json" } },
    };
  });
  Http.serve({ port: DEFAULT_DAPR_APP_PORT, controllers });
};
