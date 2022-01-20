export * from "https://deno.land/x/nano_jsx/mod.ts";
export { tw } from "https://cdn.skypack.dev/twind";

import {
  Helmet,
  renderSSR as nanoRender,
} from "https://deno.land/x/nano_jsx/mod.ts";

const html = (
  { body, head, footer, styleTag }: {
    body: string;
    head: string[];
    footer: string[];
    styleTag: string;
  },
) => (`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${head}
    ${styleTag}
  </head>
  <body>
    ${body}
    ${footer.join("\n")}
  </body>
<html>
`);

export function ssr(render: CallableFunction) {
  const app = nanoRender(render());
  const { body, head, footer } = Helmet.SSR(app);
  const styleTag =
    `<link href="https://cdn.jsdelivr.net/npm/daisyui@1.24.2/dist/full.css" rel="stylesheet" type="text/css" /><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2/dist/tailwind.min.css" rel="stylesheet" type="text/css" />`;
  return {
    body: html({ body, head, footer, styleTag }),
    init: { headers: { "content-type": "text/html" } },
  };
}
