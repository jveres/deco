// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Http } from "./httpserver.decorator.ts";
import { HTTP_RESPONSE_200 } from "../utils/Router.ts";
import { HttpMethod } from "../utils/Router.ts";
import { stringFromPropertyKey } from "../utils/utils.ts";

export const DEFAULT_DAPR_APP_PORT = 3000;
export const DEFAULT_DAPR_HTTP_PORT = 3500;
export const daprPort = Deno.env.get("DAPR_HTTP_PORT") ??
  DEFAULT_DAPR_HTTP_PORT;

export type StateConsistency = "eventual" | "strong";
export type StateConcurrency = "first-write" | "last-write";
export type Metadata = Record<string, string>;
export type ETag = string;

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
      `http://localhost:${daprPort}/v1.0/invoke/${appId}/method/${method}`;
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

interface PubSubSubscription {
  pubSubName: string;
  topic: string;
  route?: string;
  metadata?: Metadata;
}

export class PubSub {
  static readonly subscriptions: PubSubSubscription[] = [];

  static subscribeTo(
    { pubSubName, topicName, route, metadata }: {
      pubSubName: string;
      topicName: string;
      route?: string;
      metadata?: Metadata;
    },
  ): MethodDecorator {
    return (
      target: Object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      route ??= stringFromPropertyKey(propertyKey);
      PubSub.subscriptions.push({
        pubSubName,
        topic: topicName,
        route,
        metadata,
      });
      Http.addRouteToObject(
        {
          method: "POST",
          path: `/${route}`,
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

export class Bindings {
  static invoke({ bindingName, data, metadata, operation }: {
    bindingName: string;
    data?: any;
    metadata?: Metadata;
    operation?: string;
  }) {
    const url = `http://localhost:${daprPort}/v1.0/bindings/${bindingName}`;
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
      Http.addRouteToObject(
        {
          method: "OPTIONS",
          path: `/${bindingName}`,
          handler: () => HTTP_RESPONSE_200,
          object: target,
        },
      );
      Http.addRouteToObject(
        {
          method: "POST",
          path: `/${bindingName}`,
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
    "concurrency": StateConcurrency;
    "consistency": StateConsistency;
  };
}

export class State {
  static async set(
    { storename, data }: { storename: string; data: StateObject[] },
  ): Promise<Response> {
    const url = `http://localhost:${daprPort}/v1.0/state/${storename}`;
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
  }): Promise<Response> {
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
    if ([200, 204].includes(res.status)) return res;
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
  }): Promise<Response> {
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
    if (res.status === 200) return res;
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

type ActorMethod = {
  target: object | undefined;
  method: Function;
};

type VirtualActor = {
  instances: Set</* ActorId */ string>;
  methodNames: Map</* ActorMethodName */ string, ActorMethod>;
  eventHandlers: Map<ActorEvent, ActorMethod>;
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
  static readonly registeredActors = new Map<
    string, /* ActorType */
    VirtualActor
  >();

  static eventHandler(
    { actorType, event }: {
      actorType?: string;
      event?: ActorEvent;
    } = {},
  ): MethodDecorator {
    return (
      target: Object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      // Register actor event handlers
      actorType ??= target.constructor.name;
      event ??= stringFromPropertyKey(propertyKey) as ActorEvent;
      const registeredActorType = getOrCreateVirtualActor(actorType);
      registeredActorType.eventHandlers.set(event, {
        target,
        method: descriptor.value,
      });
    };
  }

  static method(
    { actorType, methodName }: {
      actorType?: string;
      methodName?: string;
    } = {},
  ): MethodDecorator {
    return (
      target: Object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      // Register actor type with empty tracking list
      actorType ??= target.constructor.name;
      methodName ??= stringFromPropertyKey(propertyKey);
      const registeredActorType = getOrCreateVirtualActor(actorType);
      registeredActorType.methodNames.set(
        methodName,
        {
          target,
          method: descriptor.value,
        },
      );
    };
  }

  static async invoke({ actorType, actorId, methodName, data }: {
    actorType: string;
    actorId: string;
    methodName: string;
    data?: any;
  }): Promise<Response> {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/method/${methodName}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
    });
    if (res.status === 200) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.invoke(): actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async createReminder(
    { actorType, actorId, methodName, dueTime, period, data }: {
      actorType: string;
      actorId: string;
      methodName: string;
      dueTime: string;
      period: string;
      data?: any;
    },
  ): Promise<Response> {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/reminders/${methodName}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ dueTime, period, ...data && { data } }),
      headers: { "content-type": "application/json" },
    });
    if (res.status === 204) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.createReminder(): actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async getReminder(
    { actorType, actorId, methodName }: {
      actorType: string;
      actorId: string;
      methodName: string;
    },
  ): Promise<Response> {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/reminders/${methodName}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "content-type": "application/json" },
    });
    if (res.status === 200) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.getReminder(): actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async deleteReminder(
    { actorType, actorId, methodName }: {
      actorType: string;
      actorId: string;
      methodName: string;
    },
  ): Promise<Response> {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/reminders/${methodName}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (res.status === 204) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.deleteReminder(): actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async createTimer(
    { actorType, actorId, methodName, dueTime, period, data }: {
      actorType: string;
      actorId: string;
      methodName: string;
      dueTime: string;
      period: string;
      data?: any;
    },
  ): Promise<Response> {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/timers/${methodName}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ dueTime, period, ...data && { data } }),
      headers: { "content-type": "application/json" },
    });
    if (res.status === 204) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.createTimer(): actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async deleteTimer(
    { actorType, actorId, methodName }: {
      actorType: string;
      actorId: string;
      methodName: string;
    },
  ): Promise<Response> {
    const url =
      `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/timers/${methodName}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (res.status === 204) return res;
    else {
      const { status, statusText } = res;
      throw Error(
        `Error during Actor.deleteTimer(): actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
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
    ): Promise<Response> {
      const url =
        `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/state/${key}`;
      const res = await fetch(url);
      if ([200, 204].includes(res.status)) return res;
      else {
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
    ): Promise<Response> {
      const url =
        `http://localhost:${daprPort}/v1.0/actors/${actorType}/${actorId}/state`;
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      });
      if (res.status === 200) return res;
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

const activateVirtualActor = async (
  { actorType, actorId, methodName, request }: {
    actorType: string;
    actorId: string;
    methodName: string;
    request: Request;
  },
): Promise<VirtualActor> => {
  const virtualActor = Actor.registeredActors.get(actorType);
  if (!virtualActor) {
    throw Error(
      `Actor type is not registered, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"`,
    );
  }
  if (!virtualActor.methodNames.has(methodName)) {
    throw Error(
      `Actor method is not registered, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"`,
    );
  }
  if (!virtualActor.instances.has(actorId)) { // activate first
    virtualActor.instances.add(actorId);
    console.log(
      `Actor activated, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"`,
    );
    const { method, target } =
      virtualActor.eventHandlers.get(ActorEvent.Activate) || {};
    await method?.apply(target, [{
      actorType,
      actorId,
      methodName,
      request,
    }]);
  }
  return virtualActor;
};

const deactivateVirtualActor = async (
  { actorType, actorId, request }: {
    actorType: string;
    actorId: string;
    request: Request;
  },
): Promise<VirtualActor | undefined> => {
  const virtualActor = Actor.registeredActors.get(actorType);
  if (virtualActor) {
    // Delete actor instance from the tracking list
    if (virtualActor.instances.has(actorId)) {
      const { method, target } =
        virtualActor.eventHandlers.get(ActorEvent.Deactivate) || {};
      await method?.apply(
        target,
        [{
          actorType,
          actorId,
          request,
        }],
      );
      virtualActor.instances.delete(actorId);
      return virtualActor;
    }
    console.warn(
      `Warning: Actor Id not found during deactivation, actorType="${actorType}", actorId="${actorId}"`,
    );
  }
};

export class Dapr {
  static App(): ClassDecorator {
    return Http.Server({ instantiate: true });
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
              body: JSON.stringify(
                PubSub.subscriptions.map((subscription) =>
                  Object.assign({}, {
                    pubsubname: subscription.pubSubName,
                    topic: subscription.topic,
                    route: subscription.route,
                    metadata: subscription.metadata,
                  })
                ),
              ),
              init: { headers: { "content-type": "application/*+json" } },
            };
          },
        },
      });
    }
    // Complete actor registration
    if (Actor.registeredActors.size > 0) {
      const config = {
        entities: Array.from(Actor.registeredActors.keys()),
        ...actorIdleTimeout && { actorIdleTimeout },
        ...actorScanInterval && { actorScanInterval },
        ...drainOngoingCallTimeout && { drainOngoingCallTimeout },
        ...drainRebalancedActors && { drainRebalancedActors },
      };
      // Setup proper target ref for Actor methods
      for (const [_, virtualActor] of Actor.registeredActors) {
        for (const [_, method] of virtualActor.eventHandlers) {
          const { target } = method;
          if (target && Reflect.get(target, Http.TARGET_KEY)) {
            method.target = Reflect.get(target, Http.TARGET_KEY);
          }
        }
        for (const [_, method] of virtualActor.methodNames) {
          const { target } = method;
          if (target && Reflect.get(target, Http.TARGET_KEY)) {
            method.target = Reflect.get(target, Http.TARGET_KEY);
          }
        }
      }
      // Registered actors
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
      // Register invoke
      Http.router.add(
        {
          method: "PUT",
          path: `/actors/:actorType/:actorId/method/:methodName`,
          action: {
            handler: async function (
              { actorType, actorId, methodName, request }: {
                actorType: string;
                actorId: string;
                methodName: string;
                request: Request;
              },
            ) {
              console.log(
                `Invoke actor service code called, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"`,
              );
              let status = 404; // actor not found
              try {
                const virtualActor = await activateVirtualActor({
                  actorType,
                  actorId,
                  methodName,
                  request,
                });
                status = 500; // request failed
                const { method, target } = virtualActor.methodNames.get(
                  methodName,
                ) || {};
                // invoke actor method
                const res = await method?.apply(target, [{
                  actorType,
                  actorId,
                  methodName,
                  request,
                }]);
                return { body: JSON.stringify(res) }; // status: 200
              } catch (err) {
                console.error(
                  `Invoke actor failed, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"\n${err}`,
                );
                return { init: { status } }; // actor not found or request failed
              }
            },
          },
        },
      );
      // Register deactivation
      Http.router.add(
        {
          method: "DELETE",
          path: `/actors/:actorType/:actorId`,
          action: {
            handler: async function (
              { actorType, actorId, request }: {
                actorType: string;
                actorId: string;
                request: Request;
              },
            ) {
              console.log(
                `Deactivate actor service code called, actorType="${actorType}", actorId="${actorId}"`,
              );
              let status = 404; // actor not found
              try {
                if (!Actor.registeredActors.has(actorType)) {
                  throw Error(
                    `Actor type not found during deactivation, actorType="${actorType}", actorId="${actorId}"`,
                  );
                } else {
                  status = 500; // request failed
                  await deactivateVirtualActor({
                    actorType,
                    actorId,
                    request,
                  });
                }
                return; // status: 200
              } catch (err: unknown) {
                console.error(
                  `Deactivate actor failed, actorType="${actorType}", actorId="${actorId}"\n${err}`,
                );
                return { init: { status } }; // actor not found or request failed
              }
            },
          },
        },
      );
      // Register reminder invocation
      Http.router.add(
        {
          method: "PUT",
          path: `/actors/:actorType/:actorId/method/remind/:reminderName`,
          action: {
            handler: async function (
              { actorType, actorId, reminderName, request }: {
                actorType: string;
                actorId: string;
                reminderName: string;
                request: Request;
              },
            ) {
              console.log(
                `Actor reminder called, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}"`,
              );
              let status = 404; // actor not found
              try {
                const virtualActor = await activateVirtualActor({
                  actorType,
                  actorId,
                  methodName: reminderName,
                  request,
                });
                status = 500; // request failed
                const { method, target } = virtualActor.methodNames.get(
                  reminderName,
                ) || {};
                // invoke actor method
                const res = await method?.apply(target, [{
                  actorType,
                  actorId,
                  methodName: reminderName,
                  request,
                }]);
                return { body: JSON.stringify(res) }; // status: 200
              } catch (err) {
                console.error(
                  `Invoke reminder failed, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}"\n${err}`,
                );
                return { init: { status } }; // actor not found or request failed
              }
            },
          },
        },
      );
      // Register timer invocation
      Http.router.add(
        {
          method: "PUT",
          path: `/actors/:actorType/:actorId/method/timer/:timerName`,
          action: {
            handler: async function (
              { actorType, actorId, timerName, request }: {
                actorType: string;
                actorId: string;
                timerName: string;
                request: Request;
              },
            ) {
              console.log(
                `Actor timer called, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}"`,
              );
              let status = 404; // actor not found
              try {
                const virtualActor = await activateVirtualActor({
                  actorType,
                  actorId,
                  methodName: timerName,
                  request,
                });
                status = 500; // request failed
                const { method, target } = virtualActor.methodNames.get(
                  timerName,
                ) || {};
                // invoke actor method
                const res = await method?.apply(target, [{
                  actorType,
                  actorId,
                  methodName: timerName,
                  request,
                }]);
                return { body: JSON.stringify(res) }; // status: 200
              } catch (err) {
                console.error(
                  `Invoke timer failed, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}"\n${err}`,
                );
                return { init: { status } }; // actor not found or request failed
              }
            },
          },
        },
      );
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
