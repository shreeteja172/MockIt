import { faker } from "@faker-js/faker";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { FexapiField, FexapiRoute } from "./schema";
import type {
  FexapiRuntimeConfig,
  FexapiSchemaDefinitions,
  FexapiSchemaFieldDefinition,
} from "./types/config";
import { ui } from "./cli/ui";

export type ServerOptions = {
  host?: string;
  port?: number;
  apiSpec?: GeneratedApiSpec;
  runtimeConfig?: FexapiRuntimeConfig;
  schemaDefinitions?: FexapiSchemaDefinitions;
  logRequests?: boolean;
};

export type GeneratedApiSpec = {
  port: number;
  routes: FexapiRoute[];
};

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 4000;

const toDisplayHost = (host: string): string => {
  const normalizedHost = host.trim().toLowerCase();

  if (
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1" ||
    normalizedHost === "localhost"
  ) {
    return "localhost";
  }

  return normalizedHost;
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  options: { cors: boolean; delay: number },
) => {
  const send = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options.cors) {
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Access-Control-Allow-Methods"] =
        "GET,POST,PUT,PATCH,DELETE,OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization";
    }

    response.writeHead(statusCode, headers);
    response.end(JSON.stringify(payload));
  };

  if (options.delay > 0) {
    setTimeout(send, options.delay);
    return;
  }

  send();
};

const createValueFromField = (field: FexapiField): unknown => {
  if (field.type.endsWith("[]")) {
    const baseType = field.type.slice(0, -2) as Extract<
      FexapiField["type"],
      | "number"
      | "string"
      | "boolean"
      | "date"
      | "uuid"
      | "email"
      | "url"
      | "name"
      | "phone"
    >;
    const count = faker.number.int({ min: 1, max: 5 });
    return Array.from({ length: count }, () => {
      return createValueFromField({ ...field, type: baseType });
    });
  }

  switch (field.type) {
    case "array": {
      const count = faker.number.int({ min: 1, max: 5 });
      return Array.from({ length: count }, () => {
        return (field.fields || []).reduce<Record<string, unknown>>(
          (record, childField) => {
            record[childField.name] = createValueFromField(childField);
            return record;
          },
          {},
        );
      });
    }
    case "object": {
      return (field.fields || []).reduce<Record<string, unknown>>(
        (record, childField) => {
          record[childField.name] = createValueFromField(childField);
          return record;
        },
        {},
      );
    }
    case "number":
      return faker.number.int({ min: 1, max: 10000 });
    case "string":
      return faker.lorem.words({ min: 1, max: 4 });
    case "boolean":
      return faker.datatype.boolean();
    case "date":
      return faker.date.recent({ days: 30 }).toISOString();
    case "uuid":
      return faker.string.uuid();
    case "email":
      return faker.internet.email();
    case "url":
      return faker.internet.url();
    case "name":
      return faker.person.fullName();
    case "phone":
      return faker.phone.number();
    default:
      return faker.lorem.word();
  }
};

const createRecordFromRoute = (
  route: FexapiRoute,
  params: Record<string, string> = {},
): Record<string, unknown> => {
  return route.fields.reduce<Record<string, unknown>>((record, field) => {
    if (field.name in params) {
      const value = params[field.name]!;
      if (field.type === "number") {
        const num = Number(value);
        record[field.name] = Number.isNaN(num) ? value : num;
      } else if (field.type === "boolean") {
        record[field.name] =
          value === "true" || value === "1"
            ? true
            : value === "false" || value === "0"
              ? false
              : value;
      } else {
        record[field.name] = value;
      }
    } else {
      record[field.name] = createValueFromField(field);
    }
    return record;
  }, {});
};

const resolveFakerMethod = (path: string): (() => unknown) | undefined => {
  const pathParts = path.split(".").filter(Boolean);
  let current: unknown = faker;

  for (const pathPart of pathParts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[pathPart];
  }

  if (typeof current !== "function") {
    return undefined;
  }

  return current as () => unknown;
};

const createValueFromSchemaFieldDefinition = (
  fieldDefinition: FexapiSchemaFieldDefinition,
): unknown => {
  if (fieldDefinition.type.endsWith("[]")) {
    const baseType = fieldDefinition.type.slice(0, -2) as Extract<
      FexapiSchemaFieldDefinition["type"],
      | "number"
      | "string"
      | "boolean"
      | "date"
      | "uuid"
      | "email"
      | "url"
      | "name"
      | "phone"
    >;
    const count = faker.number.int({ min: 1, max: 5 });
    return Array.from({ length: count }, () => {
      return createValueFromSchemaFieldDefinition({
        ...fieldDefinition,
        type: baseType,
        faker: undefined, // Usually faker applies to the item, or we can just pass it through
      });
    });
  }

  if (fieldDefinition.faker) {
    const fakerMethod = resolveFakerMethod(fieldDefinition.faker);
    if (fakerMethod) {
      return fakerMethod();
    }
  }

  switch (fieldDefinition.type) {
    case "number": {
      const min =
        typeof fieldDefinition.min === "number" ? fieldDefinition.min : 1;
      const max =
        typeof fieldDefinition.max === "number" ? fieldDefinition.max : 10000;

      return faker.number.int({
        min: Math.min(min, max),
        max: Math.max(min, max),
      });
    }
    case "boolean":
      return faker.datatype.boolean();
    case "date":
      return faker.date.recent({ days: 30 }).toISOString();
    case "uuid":
      return faker.string.uuid();
    case "email":
      return faker.internet.email();
    case "url":
      return faker.internet.url();
    case "name":
      return faker.person.fullName();
    case "phone":
      return faker.phone.number();
    case "string":
    default:
      return faker.lorem.words({ min: 1, max: 4 });
  }
};

const createRecordFromSchemaDefinition = (
  schemaDefinition: Record<string, FexapiSchemaFieldDefinition>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [fieldName, fieldDefinition] of Object.entries(schemaDefinition)) {
    result[fieldName] = createValueFromSchemaFieldDefinition(fieldDefinition);
  }

  return result;
};

const toCollectionKey = (routePath: string): string => {
  const segments = routePath.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) {
    return "data";
  }

  // Remove any dynamic parameters from the key (e.g. ":id" or "{id}")
  if (lastSegment.startsWith(":") || (lastSegment.startsWith("{") && lastSegment.endsWith("}"))) {
    const parentSegment = segments[segments.length - 2];
    return parentSegment
      ? parentSegment.replace(/[^a-zA-Z0-9_]/g, "_")
      : "data";
  }

  return lastSegment.replace(/[^a-zA-Z0-9_]/g, "_");
};

type MatchedRouteResult = {
  route: FexapiRoute;
  params: Record<string, string>;
};

const matchRoute = (
  routes: FexapiRoute[],
  method: string,
  pathname: string,
): MatchedRouteResult | undefined => {
  for (const route of routes) {
    if (route.method !== method) continue;

    const routeParts = route.path.split("/").filter(Boolean);
    const requestParts = pathname.split("/").filter(Boolean);

    if (routeParts.length !== requestParts.length) {
      continue;
    }

    let isMatch = true;
    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]!;
      const requestPart = requestParts[i]!;

      if (routePart.startsWith(":") || (routePart.startsWith("{") && routePart.endsWith("}"))) {
        const paramName = routePart.startsWith(":") ? routePart.slice(1) : routePart.slice(1, -1);
        params[paramName] = requestPart;
      } else if (routePart !== requestPart) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return { route, params };
    }
  }

  return undefined;
};

const createRecordFromSchemaName = (
  schemaName: string,
  schemaDefinitions: FexapiSchemaDefinitions,
): Record<string, unknown> => {
  const normalizedSchemaName = schemaName.trim().toLowerCase();

  const customSchemaDefinition = schemaDefinitions[normalizedSchemaName];
  if (customSchemaDefinition) {
    return createRecordFromSchemaDefinition(customSchemaDefinition);
  }

  return {
    id: faker.string.uuid(),
    type: normalizedSchemaName || "record",
    value: faker.lorem.words({ min: 1, max: 4 }),
    createdAt: faker.date.recent({ days: 7 }).toISOString(),
  };
};

const getCountOverrideFromUrl = (
  urlText: string | undefined,
): number | undefined => {
  if (!urlText) {
    return undefined;
  }

  const url = new URL(urlText, "http://localhost");
  const rawCount = url.searchParams.get("count");

  if (rawCount === null) {
    return undefined;
  }

  const parsedCount = Number(rawCount);
  if (!Number.isFinite(parsedCount)) {
    return undefined;
  }

  return Math.min(Math.max(Math.floor(parsedCount), 0), 1000);
};

const getPaginationFromUrl = (
  urlText: string | undefined,
): { page?: number; limit?: number } | undefined => {
  if (!urlText) {
    return undefined;
  }

  const url = new URL(urlText, "http://localhost");
  const rawPage = url.searchParams.get("page");
  const rawLimit = url.searchParams.get("limit");

  if (rawPage === null && rawLimit === null) {
    return undefined;
  }

  const page =
    rawPage !== null
      ? Math.max(Math.floor(Number(rawPage) || 1), 1)
      : undefined;
  const limit =
    rawLimit !== null
      ? Math.min(Math.max(Math.floor(Number(rawLimit) || 10), 1), 1000)
      : undefined;

  return { page, limit };
};

export const startServer = ({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  apiSpec,
  runtimeConfig,
  schemaDefinitions = {},
  logRequests = false,
}: ServerOptions = {}) => {
  const corsEnabled = runtimeConfig?.cors ?? false;
  const responseDelay = runtimeConfig?.delay ?? 0;
  const configuredRoutes = runtimeConfig?.routes ?? {};
  const availableConfiguredRoutes = Object.keys(configuredRoutes).map(
    (path) => `GET ${path}`,
  );
  const availableSchemaRoutes = apiSpec
    ? apiSpec.routes.map((route) => `${route.method} ${route.path}`)
    : [];
  const availableRoutes = [
    ...new Set([...availableConfiguredRoutes, ...availableSchemaRoutes]),
  ];

  const server = createServer((request, response) => {
    const requestStartedAt = Date.now();
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    if (logRequests) {
      response.on("finish", () => {
        const method = request.method ?? "UNKNOWN";
        const durationMs = Date.now() - requestStartedAt;
        const statusCode = response.statusCode;
        const statusLabel =
          statusCode >= 500
            ? ui.red(String(statusCode))
            : statusCode >= 400
              ? ui.yellow(String(statusCode))
              : ui.green(String(statusCode));
        const methodLabel =
          method === "GET"
            ? ui.cyan(method)
            : method === "POST"
              ? ui.green(method)
              : method === "DELETE"
                ? ui.red(method)
                : ui.blue(method);
        console.log(
          `${ui.gray("req")} ${methodLabel} ${pathname} ${statusLabel} ${ui.dim(`(${durationMs}ms)`)}`,
        );
      });
    }

    if (corsEnabled && request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      });
      response.end();
      return;
    }

    if (apiSpec) {
      const matchResult = matchRoute(
        apiSpec.routes,
        request.method ?? "GET",
        pathname,
      );

      if (matchResult) {
        const { route: matchedRoute, params } = matchResult;
        const method = request.method ?? "GET";

        if (method === "GET") {
          const pagination = getPaginationFromUrl(request.url);

          if (pagination) {
            const page = pagination.page ?? 1;
            const limit = pagination.limit ?? 10;
            const total = faker.number.int({
              min: limit * page,
              max: limit * (page + 5),
            });

            sendJson(
              response,
              200,
              {
                data: Array.from({ length: limit }, () =>
                  createRecordFromRoute(matchedRoute, params),
                ),
                meta: {
                  total,
                  page,
                  hasMore: page * limit < total,
                },
              },
              { cors: corsEnabled, delay: responseDelay },
            );
            return;
          }

          const count = getCountOverrideFromUrl(request.url) ?? 5;
          const payloadKey = toCollectionKey(matchedRoute.path);

          sendJson(
            response,
            200,
            {
              [payloadKey]: Array.from({ length: count }, () =>
                createRecordFromRoute(matchedRoute, params),
              ),
            },
            { cors: corsEnabled, delay: responseDelay },
          );
          return;
        }

        if (method === "DELETE") {
          sendJson(
            response,
            200,
            { message: `Deleted resource at ${matchedRoute.path}` },
            { cors: corsEnabled, delay: responseDelay },
          );
          return;
        }
        const bodyChunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => bodyChunks.push(chunk));
        request.on("end", () => {
          let requestBody: Record<string, unknown> = {};
          try {
            const raw = Buffer.concat(bodyChunks).toString("utf-8");
            if (raw.trim()) {
              requestBody = JSON.parse(raw) as Record<string, unknown>;
            }
          } catch {
            requestBody = {};
          }

          const generatedRecord = createRecordFromRoute(matchedRoute, params);
          const merged = { ...generatedRecord, ...requestBody };
          const statusCode = method === "POST" ? 201 : 200;

          sendJson(response, statusCode, merged, {
            cors: corsEnabled,
            delay: responseDelay,
          });
        });
        return;
      }
    }

    if (request.method === "GET") {
      const configuredRoute = configuredRoutes[pathname];
      if (configuredRoute) {
        const pagination = getPaginationFromUrl(request.url);

        if (pagination) {
          const page = pagination.page ?? 1;
          const limit = pagination.limit ?? 10;
          const total = faker.number.int({
            min: limit * page,
            max: limit * (page + 5),
          });

          sendJson(
            response,
            200,
            {
              data: Array.from({ length: limit }, () =>
                createRecordFromSchemaName(
                  configuredRoute.schema,
                  schemaDefinitions,
                ),
              ),
              meta: {
                total,
                page,
                hasMore: page * limit < total,
              },
            },
            { cors: corsEnabled, delay: responseDelay },
          );
          return;
        }

        const count =
          getCountOverrideFromUrl(request.url) ?? configuredRoute.count;
        const payloadKey = toCollectionKey(pathname);
        sendJson(
          response,
          200,
          {
            [payloadKey]: Array.from({ length: count }, () =>
              createRecordFromSchemaName(
                configuredRoute.schema,
                schemaDefinitions,
              ),
            ),
          },
          { cors: corsEnabled, delay: responseDelay },
        );
        return;
      }
    }

    sendJson(
      response,
      404,
      {
        message: "Route not found",
        availableRoutes,
      },
      { cors: corsEnabled, delay: responseDelay },
    );
  });

  server.listen(port, host, () => {
    const displayHost = toDisplayHost(host);
    console.log(
      `${ui.green("ready")} Mock API running at ${ui.bold(`http://${displayHost}:${port}`)}`,
    );
  });

  return server;
};
