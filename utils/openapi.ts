// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  transformOas3Operation,
  transformOas3Operations,
} from "https://jspm.dev/@stoplight/http-spec/oas3/operation";

export const loadOpenAPISchema = (api: string) => {
  return transformOas3Operations(api, transformOas3Operation);
};

export const documentationHTML = (schemaFile: string) => {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>OpenAPI schema</title>  
    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  </head>
  <body>
    <elements-api
      apiDescriptionUrl="${schemaFile}"
      router="hash"
    />
  </body>
</html>`;
};
