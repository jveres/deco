/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

interface EventStreamEventFormat {
  event?: string;
  data: string | string[];
  id?: string;
  retry?: number;
}

interface EventStreamCommentFormat {
  comment: string;
}

export function SSE(
  event: EventStreamEventFormat | EventStreamCommentFormat,
): string {
  if ("comment" in event) {
    return `: ${event.comment}\n\n`;
  } else {
    let res = event.event ? `event: ${event.event}\n` : "";
    if (typeof event.data === "string") res += `data: ${event.data}\n`;
    else event.data.map((data) => res += `data: ${data}\n`);
    if (event.id) res += `id: ${event.id}\n`;
    if (event.retry) res += `retry: ${event.retry}\n`;
    return `${res}\n`;
  }
}
