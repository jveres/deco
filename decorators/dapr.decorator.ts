// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Http } from "./httpserver.decorator.ts";
import { stringFromPropertyKey } from "../utils/utils.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";
import { getMetadata, setMetadata } from "./metadata.decorator.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;
export const daprPort = Deno.env.get("DAPR_HTTP_PORT") ??
  DEFAULT_DAPR_HTTP_PORT;

type Metadata = Record<string, string>;

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
        handler: async function({ request }: { request: Request }) {
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
      `http://localhost:${daprPort}/v1.0/publish/${pubSubName}/${topicName}` +
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
      // PubSub
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
