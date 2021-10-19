// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { parse as yamlParse } from "https://deno.land/std@0.112.0/encoding/yaml.ts";
import * as path from "https://deno.land/std@0.112.0/path/mod.ts";

import {
  transformOas3Operation,
  transformOas3Operations,
} from "https://jspm.dev/@stoplight/http-spec/oas3/operation";

export const loadOpenApiSpecification = async (
  filename: string,
): Promise<any> => {
  const text = await Deno.readTextFile(filename);
  const api =  path.extname(filename) === ".yaml" ? yamlParse(text) : JSON.parse(text);
  return transformOas3Operations(api, transformOas3Operation);
};