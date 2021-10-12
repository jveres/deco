// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import * as Dapr from "./decorators/dapr.decorator.ts";

const pubSubName = "pubsub";

class DaprClient {
  @Dapr.Subscribe({ pubSubName, topic: "A" })
  async topicA({ data }: { data: any }) {
    console.log("topicA =>", data);
  }

  @Dapr.Subscribe({ pubSubName, topic: "B" })
  async topicB({ data }: { data: any }) {
    console.log("topicB =>", data);
  }
}

console.log("Dapr app started...");
Dapr.start([DaprClient]);
