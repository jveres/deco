// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import * as Http from "./httpserver.decorator.ts";

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
        return {
          body: JSON.stringify({ success: "true" }),
          init: { headers: { "content-type": "application/json" } },
        };
      },
    );
    subscriptions.push(subscription);
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
