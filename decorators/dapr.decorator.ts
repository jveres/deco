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
        target: object,
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
        `Service.invoke() error, appId="${appId}", method="${method}", code=${status}, text="${statusText}"`,
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
      target: object,
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
        `PubSub.publish() error, pubSubName="${pubSubName}", topic="${topicName}", code=${status}, text="${statusText}"`,
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
      target: object,
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
        `Secrets.get() error, store="${store}", key="${key}", code=${status}, text="${statusText}"`,
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
        `Secrets.getBulk() error, store="${store}", code=${status}, text="${statusText}"`,
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
    if (res.status === 204) return;
    else {
      const { status, statusText } = res;
      throw Error(
        `State.set() error, storename="${storename}", code=${status}, text="${statusText}"`,
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
    else if (res.status === 204) return;
    else {
      const { status, statusText } = res;
      throw Error(
        `State.get() error, storename="${storename}", key="${key}", code=${status}, text="${statusText}"`,
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
        `State.getBulk() error, storename="${storename}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }
}

type ActorEvent = "activate" | "deactivate" | string;

type VirtualActor = {
  instances: Set</* ActorId */ string>;
  methods: Map</* ActorMethod */ string, Function>;
  events: Map<ActorEvent, Function>;
};

const getOrCreateVirtualActor = (
  object: object,
  actorType: string,
): VirtualActor => {
  const actors = getMetadata(
    object,
    Actor.ACTORS_KEY,
    new Map<string, VirtualActor>(),
  );
  let virtualActor = actors.get(actorType);
  if (!virtualActor) {
    virtualActor = {
      instances: new Set<string>(),
      methods: new Map<string, Function>(),
      events: new Map<ActorEvent, Function>(),
    };
    actors.set(actorType, virtualActor);
  }
  return virtualActor;
};

export class Actor {
  static readonly ACTORS_KEY = "__actors__";

  static event(
    { actorType, eventName }: {
      actorType?: string;
      eventName?: ActorEvent;
    } = {},
  ): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      actorType ??= target.constructor.name;
      eventName ??= stringFromPropertyKey(propertyKey) as ActorEvent;
      getOrCreateVirtualActor(target, actorType).events.set(
        eventName,
        descriptor.value,
      );
    };
  }

  static method(
    { actorType, methodName }: {
      actorType?: string;
      methodName?: string;
    } = {},
  ): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      actorType ??= target.constructor.name;
      methodName ??= stringFromPropertyKey(propertyKey);
      getOrCreateVirtualActor(target, actorType).methods.set(
        methodName,
        descriptor.value,
      );
    };
  }

  static async invoke({ actorType, actorId, methodName, data }: {
    actorType: string;
    actorId: string;
    methodName: string;
    data?: any;
  }) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/method/${methodName}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
    });
    if (res.status === 200) return await res.json();
    else {
      const { status, statusText } = res;
      throw Error(
        `Actor.invoke() error, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async setReminder(
    { actorType, actorId, reminderName, dueTime = "0", period = "", data }: {
      actorType: string;
      actorId: string;
      reminderName: string;
      dueTime?: string;
      period?: string;
      data?: any;
    },
  ) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/reminders/${reminderName}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ dueTime, period, ...data && { data } }),
      headers: { "content-type": "application/json" },
    });
    if (res.status !== 204) {
      const { status, statusText } = res;
      throw Error(
        `Actor.setReminder() error, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async getReminder(
    { actorType, actorId, reminderName }: {
      actorType: string;
      actorId: string;
      reminderName: string;
    },
  ) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/reminders/${reminderName}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "content-type": "application/json" },
    });
    if (res.status === 200) return await res.json();
    else {
      const { status, statusText } = res;
      throw Error(
        `Actor.getReminder() error, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async deleteReminder(
    { actorType, actorId, reminderName }: {
      actorType: string;
      actorId: string;
      reminderName: string;
    },
  ) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/reminders/${reminderName}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (res.status !== 204) {
      const { status, statusText } = res;
      throw Error(
        `Actor.deleteReminder() error, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async setTimer(
    { actorType, actorId, timerName, dueTime = "0", period = "", data }: {
      actorType: string;
      actorId: string;
      timerName: string;
      dueTime?: string;
      period?: string;
      data?: any;
    },
  ) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/timers/${timerName}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ dueTime, period, ...data && { data } }),
      headers: { "content-type": "application/json" },
    });
    if (res.status !== 204) {
      const { status, statusText } = res;
      throw Error(
        `Actor.setTimer() error, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}", code=${status}, text="${statusText}"`,
        { cause: { status, statusText } },
      );
    }
  }

  static async deleteTimer(
    { actorType, actorId, timerName }: {
      actorType: string;
      actorId: string;
      timerName: string;
    },
  ) {
    const url =
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/timers/${timerName}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (res.status !== 204) {
      const { status, statusText } = res;
      throw Error(
        `Actor.deleteTimer() error, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}", code=${status}, text="${statusText}"`,
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
        `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/state/${key}`;
      const res = await fetch(url);
      if (res.status === 200) return await res.json();
      else if(res.status === 204) return;
      else {
        const { status, statusText } = res;
        throw Error(
          `Actor.State.get() error, actorType="${actorType}", actorId="${actorId}", key="${key}", code=${status}, text="${statusText}"`,
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
        `http://localhost:${DAPR_HTTP_PORT}/v1.0/actors/${actorType}/${actorId}/state`;
      const res = await fetch(url, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "content-type": "application/json" },
      });
      if (res.status === 204) return;
      else {
        const { status, statusText } = res;
        throw Error(
          `Actor.State.set() error, actorType="${actorType}", actorId="${actorId}", code=${status}, text="${statusText}"`,
          { cause: { status, statusText } },
        );
      }
    },
  };
}

const findActor = (
  controllers: Function[],
  actorType: string,
) => {
  for (const controller of controllers) {
    const actors = <Map<string, VirtualActor>> getMetadata(
      controller.prototype,
      Actor.ACTORS_KEY,
    );
    const actor = actors?.get(actorType);
    if (actor) return { actor, controller };
  }
  return {};
};

export class Dapr {
  static AppController(
    { pubSubName }: { pubSubName?: string } = {},
  ): ClassDecorator {
    return (target: Function): void => {
      setMetadata(target.prototype, PubSub.PUBSUBNAME_KEY, pubSubName);
    };
  }

  static start(
    {
      appPort = DEFAULT_DAPR_APP_PORT,
      controllers,
      actorIdleTimeout,
      actorScanInterval,
      drainOngoingCallTimeout,
      drainRebalancedActors,
    }: {
      appPort?: number;
      controllers: Function[];
      actorIdleTimeout?: string;
      actorScanInterval?: string;
      drainOngoingCallTimeout?: string;
      drainRebalancedActors?: boolean;
    },
  ) {
    // Initialize controllers
    const subscribe: object[] = [];
    const actorConfig = {
      entities: new Array<string>(),
      ...actorIdleTimeout && { actorIdleTimeout },
      ...actorScanInterval && { actorScanInterval },
      ...drainOngoingCallTimeout && { drainOngoingCallTimeout },
      ...drainRebalancedActors && { drainRebalancedActors },
    };
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
      const actors = <Map<string, VirtualActor>> getMetadata(
        controller.prototype,
        Actor.ACTORS_KEY,
      );
      actors?.forEach((_, actorType: string) =>
        actorConfig.entities.push(actorType)
      );
    }
    // Register subscriptions
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
    // Register common actor services
    if (actorConfig.entities.length > 0) {
      // Actor config
      Http.router.add({
        method: "GET",
        path: "/dapr/config",
        action: {
          handler: () => {
            return {
              body: JSON.stringify(actorConfig),
              init: { headers: { "content-type": "application/json" } },
            };
          },
        },
      });
      // Register actor invocation
      Http.router.add({
        method: "PUT",
        path: "/actors/:actorType/:actorId/method/:methodName",
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
            const { actor, controller } = findActor(
              controllers,
              actorType,
            );
            if (!controller || !actor || !actor.methods.has(methodName)) {
              console.warn(
                `Actor not found, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"`,
              );
              return { init: { status: 404 } }; // Actor not found
            }
            const target = getMetadata(controller.prototype, Http.TARGET_KEY);
            try {
              if (!actor.instances.has(actorId)) {
                // Activate actor
                console.log(
                  `Activate actor, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"`,
                );
                actor.instances.add(actorId);
                await actor.events.get("activate")?.apply(target, [{
                  actorType,
                  actorId,
                  methodName,
                  request,
                }]);
              }
              // Run actor method
              await actor.methods.get(methodName)!.apply(
                target,
                [{
                  actorType,
                  actorId,
                  request,
                }],
              );
            } catch (err) {
              console.error(
                `Invoke actor failed, actorType="${actorType}", actorId="${actorId}", methodName="${methodName}"\n${err}`,
              );
              return { init: { status: 500 } };
            }
          },
        },
      });
      // Actor deactivation
      Http.router.add({
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
            const { actor, controller } = findActor(
              controllers,
              actorType,
            );
            if (!controller || !actor || !actor.instances.has(actorId)) {
              // Actor not found
              console.warn(
                `Actor instance not found for deactivation, actorType="${actorType}", actorId="${actorId}"`,
              );
              return;
            }
            actor.instances.delete(actorId);
            if (actor.events.has("deactivate")) {
              try {
                await actor.events.get("deactivate")?.apply(
                  getMetadata(controller.prototype, Http.TARGET_KEY),
                  [{
                    actorType,
                    actorId,
                    request,
                  }],
                );
              } catch (err) {
                console.warn(
                  `Deactivate actor error, actorType="${actorType}", actorId="${actorId}"\n${err}`,
                );
              }
            }
          },
        },
      });
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
              const { actor, controller } = findActor(
                controllers,
                actorType,
              );
              if (!controller || !actor || !actor.instances.has(actorId)) {
                // Actor not found
                console.error(
                  `Actor not found for reminder invocation, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}"`,
                );
                return { init: { status: 404 } };
              }
              if (actor.events.has(reminderName)) {
                try {
                  await actor.events.get(reminderName)?.apply(
                    getMetadata(controller.prototype, Http.TARGET_KEY),
                    [{
                      actorType,
                      actorId,
                      reminderName,
                      request,
                    }],
                  );
                } catch (err) {
                  console.error(
                    `Reminder invocation error, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}"\n${err}`,
                  );
                  return { init: { status: 500 } }; // Internal error
                }
              } else {
                console.warn(
                  `Actor has no reminder event defined, actorType="${actorType}", actorId="${actorId}", reminderName="${reminderName}"`,
                );
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
              const { actor, controller } = findActor(
                controllers,
                actorType,
              );
              if (!controller || !actor || !actor.instances.has(actorId)) {
                // Actor not found
                console.error(
                  `Actor not found for timer invocation, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}"`,
                );
                return { init: { status: 404 } };
              }
              if (actor.events.has(timerName)) {
                try {
                  await actor.events.get(timerName)?.apply(
                    getMetadata(controller.prototype, Http.TARGET_KEY),
                    [{
                      actorType,
                      actorId,
                      timerName,
                      request,
                    }],
                  );
                } catch (err) {
                  console.error(
                    `Timer invocation error, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}"\n${err}`,
                  );
                  return { init: { status: 500 } }; // Internal error
                }
              } else {
                console.warn(
                  `Actor has no timer event defined, actorType="${actorType}", actorId="${actorId}", timerName="${timerName}"`,
                );
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
    // Start Http server
    Http.serve({ port: appPort, controllers });
  }
}
