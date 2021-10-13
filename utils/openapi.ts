import { parse as yamlParse } from "https://deno.land/std@0.111.0/encoding/yaml.ts";
import * as path from "https://deno.land/std@0.111.0/path/mod.ts";

import {
  transformOas3Operation,
  transformOas3Operations,
} from "https://jspm.dev/@stoplight/http-spec/oas3/operation";

export const loadOpenApiSpecification = async (
  filename: string,
): Promise<any> => {
  let text = await Deno.readTextFile(filename);
  const api =  path.extname(filename) === ".yaml" ? yamlParse(text) : JSON.parse(text);
  return transformOas3Operations(api, transformOas3Operation);
};