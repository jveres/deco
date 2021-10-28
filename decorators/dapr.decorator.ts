// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Http } from "./httpserver.decorator.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";
import { HttpMethod } from "../utils/Router.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;
export const daprPort = Deno.env.get("DAPR_HTTP_PORT") ??
  DEFAULT_DAPR_HTTP_PORT;

export type Consistency = "eventual" | "strong";
export type Concurrency = "first-write" | "last-write";
export type Metadata = Record<string, string>;
export type ETag = string;

export class Service {
  static expose({ name, verb = "POST" }: {
    name: string;
    verb?: HttpMethod;
  }): MethodDecorator {
    return Http.Route({ method: verb, path: `/${name}` });
  }

  static async invoke(
    { appId, method, data }: { appId: string; method: string; data?: any },
  ) {
    const url =
      `http://localhost:${daprPort}/v1.0/invoke/${appId}/method/${method}`;
    const res = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      },
    );
    if (res.status === 200) return await res.text();
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Service.invoke(): appId="${appId}", method="${method}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }
}

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
      PubSub.subscriptions.push(subscriptions);
      Http.addRouteToObject(
        {
          method: "POST",
          path: `/${subscriptions.route}`,
          handler: async ({ request }: { request: Request }) => {
            descriptor.value(await request.json());
            return HTTP_RESPONSE_200;
          },
          object: target,
        },
      );
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
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      },
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
        headers: { "content-type": "application/json" },
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
      Http.addRouteToObject(
        {
          method: "OPTIONS",
          path: `/${name}`,
          handler: () => HTTP_RESPONSE_200,
          object: target,
        },
      );
      Http.addRouteToObject(
        {
          method: "POST",
          path: `/${name}`,
          handler: async ({ request }: { request: Request }) => {
            descriptor.value(await request.json());
            return HTTP_RESPONSE_200;
          },
          object: target,
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
        headers: { "content-type": "application/json" },
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
        headers: { "content-type": "application/json" },
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

export enum ActorEvent {
  Activate = "activate",
  Deactivate = "deactivate",
}

type ActorType = string;
type ActorId = string;
type ActorMethod = string;
type ActorFn = {
  target: Object | undefined;
  fn: Function;
};

type VirtualActor = {
  instances: Set<ActorId>;
  methodNames: Map<ActorMethod, ActorFn>;
  eventHandlers: Map<ActorEvent, ActorFn>;
};

const getOrCreateVirtualActor = (actorType: string): VirtualActor => {
  let virtualActor = Actor.registeredActors.get(actorType);
  if (!virtualActor) {
    virtualActor = {
      instances: new Set(),
      methodNames: new Map(),
      eventHandlers: new Map(),
    };
    Actor.registeredActors.set(actorType, virtualActor);
  }
  return virtualActor;
};

export class Actor {
  static readonly registeredActors = new Map<ActorType, VirtualActor>();

  static registerEventHandler(
    { actorType, event }: {
      actorType: string;
      event: ActorEvent;
    },
  ): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      // Register actor event handlers
      const registeredActorType = getOrCreateVirtualActor(actorType);
      registeredActorType.eventHandlers.set(event, {
        target,
        fn: descriptor.value,
      });
    };
  }

  static registerMethod(
    { actorType, methodName }: {
      actorType: string;
      methodName: string;
    },
  ): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      // Register actor type with empty tracking list
      const registeredActorType = getOrCreateVirtualActor(actorType);
      registeredActorType.methodNames.set(
        methodName,
        {
          target,
          fn: descriptor.value,
        },
      );
    };
  }

  static async invoke({ actorType, actorId, method, data }: {
    actorType: string;
    actorId: string;
    method: string;
    data?: any;
  }) {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/method/${method}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
    });
    if (res.status === 200) return res.json();
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.invoke(): actorType="${actorType}", actorId="${actorId}", method="${method}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static readonly State = {
    async get(
      { actorType, actorId, key }: {
        actorType: string;
        actorId: string;
        key: string;
      },
    ) {
      const url =
        `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/state/${key}`;
      const res = await fetch(url);
      if (res.status === 200) return res.json();
      else {
        if (res.status === 204) return undefined;
        const { status, statusText } = res;
        throw Error(
          `Error during Actor.invoke(): actorType="${actorType}", actorId="${actorId}", key="${key}", code=${status}, text="${statusText}"`,
          { cause: { status, statusText } },
        );
      }
    },

    async set(
      { actorType, actorId, data }: {
        actorType: string;
        actorId: string;
        data: any;
      },
    ) {
      const url =
        `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/state`;
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      });
      if (res.status === 200) return res.json();
      else {
        const { status, statusText } = res;
        throw Error(
          `Error during Actor.invoke(): actorType="${actorType}", actorId="${actorId}", code=${status}, text="${statusText}"`,
          { cause: { status, statusText } },
        );
      }
    },
  };
}

export class Dapr {
  static App(): ClassDecorator {
    return Http.Server();
  }

  static start(
    {
      appPort,
      actorIdleTimeout,
      actorScanInterval,
      drainOngoingCallTimeout,
      drainRebalancedActors,
    }: {
      appPort?: number;
      actorIdleTimeout?: string;
      actorScanInterval?: string;
      drainOngoingCallTimeout?: string;
      drainRebalancedActors?: boolean;
    } = {},
  ) {
    appPort ??= DEFAULT_DAPR_APP_PORT;
    // Configure PubSub subscriptions
    if (PubSub.subscriptions.length > 0) {
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
    // Setup actors
    if (Actor.registeredActors.size > 0) {
      const config = {
        entities: Array.from(Actor.registeredActors.keys()),
        ...actorIdleTimeout && { actorIdleTimeout },
        ...actorScanInterval && { actorScanInterval },
        ...drainOngoingCallTimeout && { drainOngoingCallTimeout },
        ...drainRebalancedActors && { drainRebalancedActors },
      };
      // Provide actor config for Dapr
      Http.router.add({
        method: "GET",
        path: "/dapr/config",
        action: {
          handler: () => {
            return {
              body: JSON.stringify(config),
              init: { headers: { "content-type": "application/json" } },
            };
          },
        },
      });
      // Register actors
      for (const [actorType] of Actor.registeredActors) {
        // Register actorType for invocation
        Http.router.add(
          {
            method: "PUT",
            path: `/actors/${actorType}/:actorId/method/:methodName`,
            action: {
              handler: async function (
                { actorId, methodName, request }: {
                  actorId: string;
                  methodName: string;
                  request: Request;
                },
              ) {
                console.log(
                  `Invoke actor called with actorType=${actorType}, actorId=${actorId}, methodName=${methodName}`,
                );
                let status = 404;
                try {
                  const virtualActor = Actor.registeredActors.get(actorType);
                  if (!virtualActor) {
                    throw Error("Actor type is not registered");
                  }
                  if (!virtualActor.methodNames.has(methodName)) {
                    throw Error("Actor method is not registered");
                  }
                  if (!virtualActor.instances.has(actorId)) { // activate actor
                    virtualActor.instances.add(actorId);
                    console.log(
                      `Actor activated with actorType=${actorType}, actorId=${actorId}, methodName=${methodName}`,
                    );
                    const { fn, target } =
                      virtualActor.eventHandlers.get(ActorEvent.Activate) || {};
                    await fn?.apply(target, [{
                      actorType,
                      actorId,
                      methodName,
                      request,
                    }]);
                  }
                  status = 500;
                  const { fn, target } =
                    virtualActor.methodNames.get(methodName) || {};
                  const res = await fn?.apply(target, [{
                    actorType,
                    actorId,
                    methodName,
                    request,
                  }]);
                  return { body: JSON.stringify(res) };
                } catch (err) {
                  console.error(
                    `Invoke actor failed with actorType=${actorType}, actorId=${actorId}, methodName=${methodName}\n${err}`,
                  );
                  return { init: { status } };
                }
              },
            },
          },
        );
        // Register actorType for deactivation
        Http.router.add(
          {
            method: "DELETE",
            path: `/actors/${actorType}/:actorId`,
            action: {
              handler: async function (
                { actorId, request }: { actorId: string; request: Request },
              ) {
                console.log(
                  `Deactivate actor called with actorType=${actorType}, actorId=${actorId}`,
                );
                try {
                  const virtualActor = Actor.registeredActors.get(actorType);
                  if (virtualActor === undefined) {
                    console.warn(
                      `Instance for actorType="${actorType}", actorId="${actorId}" not found, cannot delete`,
                    );
                  } else {
                    // Delete actor instance from the tracking list
                    if (virtualActor.instances.has(actorId)) {
                      const { fn, target } =
                        virtualActor.eventHandlers.get(ActorEvent.Deactivate) ||
                        {};
                      await fn?.apply(
                        target,
                        [{
                          actorType,
                          actorId,
                          request,
                        }],
                      );
                      virtualActor.instances.delete(actorId);
                      return;
                    }
                    console.warn(
                      "Warning: actorId was not found during delete",
                    );
                  }
                } catch (err) {
                  console.error(
                    `Deactivate actor failed with actorType=${actorType}, actorId=${actorId}\n${err}`,
                  );
                  return { init: { status: 500 } };
                }
              },
            },
          },
        );
      }
      // Health check
      Http.router.add({
        method: "GET",
        path: "/healthz",
        action: {
          handler: () => HTTP_RESPONSE_200,
        },
      });
    }
    Http.serve({ port: appPort });
  }
}
