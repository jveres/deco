/** @jsx h */

import { h, Helmet, renderSSR } from "./nano.ts";

const App = () => (
  <div>
    <Helmet>
      <title>Nano JSX SSR served by Deco</title>
      <meta
        name="description"
        content="Server Side Rendered Nano JSX Application"
      />
    </Helmet>
    <h1>Hello from Deco! 😎 (server side rendered)</h1>
  </div>
);

const ssr = renderSSR(<App />);
const { body, head, footer } = Helmet.SSR(ssr);

export const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${head.join("\n")}
  </head>
  <body>
    ${body}
    ${footer.join("\n")}
  </body>
</html>`;
