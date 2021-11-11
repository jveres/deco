// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// Start Dapr sidecar in local environment:
//    dapr run --app-id sidecar --dapr-http-port 3500 --components-path ./components
// Run the example:
//    dapr --app-id deco-app --app-port 3000 --components-path ./components run -- deno run -A --unstable --watch example_dapr.ts
// Publish message to topic A:
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic A --data '{"data": "message for topic A"}'
// Publish message to topic B and get Telegrom notification (needs TELEGRAM_TOKEN and TELEGRAM_CHATID exist in the secrets store):
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic B --data '{"text": "Hello from Deco.Dapr!"}'
// Publish message to topic C to see raw message format:
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic C --data '{"raw": "raw message for topic C"}'
// Invoke "test" service
//    dapr invoke --app-id deco-app --verb GET --method test
// Send data to the actor
//    curl -X POST "http://localhost:3500/v1.0/actors/TestActor/1/method/testMethod1" -d "{test: 'data'}"

import { Dapr, PubSub } from "../../decorators/dapr.decorator.ts";

@Dapr.AppController({ pubSubName: "pubsub" })
class ExampleApp1 {
  private s = "exampleapp1";
  @PubSub.subscribeTo()
  A({ data }: { data: unknown }) {
    console.log("topicA =>", data, this);
  }

  @PubSub.subscribeTo()
  B({ data }: { data: Record<string, unknown> }) {
    console.log("topicB =>", data, this);
  }
}

@Dapr.AppController({ pubSubName: "pubsub" })
class ExampleApp2 {
  private s = "exampleapp2";
  @PubSub.subscribeTo({ metadata: { rawPayload: "true" } })
  C(raw: Record<string, unknown>) {
    console.log("topicC =>", raw, this);
  }
}

console.log("Dapr app started...");
Dapr.start({ appPort: 3000, controllers: [ExampleApp1, ExampleApp2] });
