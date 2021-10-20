[![Deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/deco@0.6.2/mod.ts)

# Deco (**deh** · kow) is a helper library for [Deno](https://deno.land) developers (still work in progress)

- Fault tolerance helpers (@Timeout, @Retry, @Try, @Trace, @Debounce, @Throttle, @RateLimit, @Concurrecy, @Memoize)
- REST API helpers (@Http.xxx) with OpenAPI support
- Dapr helpers (@Dapr.xxx)

## Dapr [example](examples/dapr/example_dapr.ts)
```typescript
const { TELEGRAM_CHATID, TELEGRAM_TOKEN } = await Secrets.getAll(
  "example-secrets-store",
);
const PUBSUBNAME = "pubsub";

class DaprApp {
  @PubSub.subscribe({ pubSubName: PUBSUBNAME, topic: "A" })
  topicA({ data }: { data: unknown }) {
    console.log("topicA =>", data);
  }

  @PubSub.subscribe({ pubSubName: PUBSUBNAME, topic: "B" })
  topicB({ data }: { data: Record<string, unknown> }) {
    console.log("topicB =>", data);
    if (data.text && TELEGRAM_CHATID && TELEGRAM_TOKEN) {
      const { text } = data;
      const path =
        `/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHATID}&text=${text}`;
      Bindings.invoke({
        name: "telegram",
        operation: "get",
        metadata: { path },
      });
    }
  }

  @PubSub.subscribe({
    pubSubName: PUBSUBNAME,
    topic: "C",
    metadata: { rawPayload: "true" },
  })
  topicC(raw: Record<string, unknown>) {
    console.log("topicC =>", raw);
  }

  @Bindings.listenTo("tweets")
  tweets({ text }: { text: Record<string, unknown> }) {
    PubSub.publish({
      data: { text },
      pubSubName: PUBSUBNAME,
      topic: "A",
    });
  }
}

console.log("Dapr app started...");
Dapr.start({ appPort: 3000, controllers: [DaprApp] });
```
## Running tests
```sh
deno test --allow-net
```
