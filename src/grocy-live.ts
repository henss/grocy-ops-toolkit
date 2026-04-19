import fs from "node:fs";
import path from "node:path";
import type { GrocyConfigEntity } from "./schemas.js";

export interface GrocyLiveConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface ToolAdapterStatus {
  toolId: "grocy";
  reachable: boolean;
  mode: "read_only" | "write_enabled";
  notes: string[];
}

export interface GrocyHealthCheckResult {
  status: ToolAdapterStatus;
  stockCount?: number;
  shoppingListCount?: number;
  productCount?: number;
}

export interface GrocyHealthCheckOptions {
  configPath?: string;
}

export interface GrocyObjectRecord {
  id?: string;
  entity: GrocyConfigEntity;
  fields: Record<string, unknown>;
}

export interface GrocyStockRecord {
  productId?: string;
  productName: string;
  quantity?: string;
  quantityNumeric?: number;
  location?: string;
  stockState: "in_stock" | "low" | "out" | "unknown";
  minStockAmount?: number;
  quantityUnitPurchaseId?: string;
  quantityUnitStockId?: string;
  notes?: string[];
}

export interface GrocyShoppingListRecord {
  itemId: string;
  productId?: string;
  productName: string;
  quantity?: string;
  quantityNumeric?: number;
  quantityUnitId?: string;
  note?: string;
  done: boolean;
}

export interface GrocyProductRecord {
  productId: string;
  productName: string;
  minStockAmount?: string;
  quantityUnitPurchaseId?: string;
  quantityUnitStockId?: string;
  defaultBestBeforeDays?: string;
  dueType?: string;
  note?: string;
}

export const DEFAULT_GROCY_CONFIG_PATH = path.join("config", "grocy.local.json");

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/g, "");
  return trimmed.toLowerCase().endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function parseConfig(raw: unknown): GrocyLiveConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Grocy config must be an object.");
  }

  const record = raw as Record<string, unknown>;
  const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl : "";
  const apiKey = typeof record.apiKey === "string" ? record.apiKey : "";
  const timeoutMs = typeof record.timeoutMs === "number" ? record.timeoutMs : 10000;

  if (!baseUrl.trim()) {
    throw new Error("Grocy config is missing baseUrl.");
  }
  if (!apiKey.trim()) {
    throw new Error("Grocy config is missing apiKey.");
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey: apiKey.trim(),
    timeoutMs,
  };
}

export function loadGrocyLiveConfig(
  baseDir: string = process.cwd(),
  configPath = DEFAULT_GROCY_CONFIG_PATH,
): GrocyLiveConfig | undefined {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }
  return parseConfig(JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown);
}

export function getGrocyConfigStatus(
  baseDir: string = process.cwd(),
  configPath = DEFAULT_GROCY_CONFIG_PATH,
): ToolAdapterStatus {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      toolId: "grocy",
      reachable: false,
      mode: "write_enabled",
      notes: [`No Grocy live config found at ${absolutePath}.`],
    };
  }

  const config = loadGrocyLiveConfig(baseDir, configPath);
  return {
    toolId: "grocy",
    reachable: false,
    mode: "write_enabled",
    notes: [
      `Grocy live config is present at ${absolutePath}.`,
      `Configured base URL: ${config?.baseUrl ?? "unknown"}`,
    ],
  };
}

async function fetchGrocyJson<T>(
  config: GrocyLiveConfig,
  relativePath: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(`${config.baseUrl}${relativePath}`, {
    headers: {
      "GROCY-API-KEY": config.apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Grocy request failed: ${response.status} ${response.statusText} for ${relativePath}`);
  }
  return (await response.json()) as T;
}

async function sendGrocyJson<T>(
  config: GrocyLiveConfig,
  relativePath: string,
  fetchImpl: typeof fetch,
  options: { method: "POST" | "PUT"; body?: unknown },
): Promise<T> {
  const response = await fetchImpl(`${config.baseUrl}${relativePath}`, {
    method: options.method,
    headers: {
      "GROCY-API-KEY": config.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Grocy request failed: ${response.status} ${response.statusText} for ${relativePath}`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
}

function mapGrocyObjectRecord(entity: GrocyConfigEntity, raw: unknown): GrocyObjectRecord {
  const fields = (raw ?? {}) as Record<string, unknown>;
  return { id: asString(fields.id), entity, fields };
}

function mapGrocyStockRecord(raw: unknown): GrocyStockRecord {
  const record = (raw ?? {}) as Record<string, unknown>;
  const product = (record.product ?? {}) as Record<string, unknown>;
  const location = (record.location ?? {}) as Record<string, unknown>;
  const notes = [asString(record.note), asString(product.description)].filter((value): value is string => Boolean(value));
  const amount =
    typeof record.amount_aggregated === "number"
      ? record.amount_aggregated
      : typeof record.amount === "number"
        ? record.amount
        : typeof record.stock_amount === "number"
          ? record.stock_amount
          : undefined;
  return {
    productId: asString(record.product_id) ?? asString(product.id),
    productName: asString(record.product_name) ?? asString(product.name) ?? asString(record.name) ?? "Unknown product",
    quantity: asString(record.amount_aggregated) ?? asString(record.amount) ?? asString(record.stock_amount),
    quantityNumeric: amount,
    location: asString(location.name) ?? asString(record.location_name),
    stockState: amount === undefined ? "unknown" : amount <= 0 ? "out" : amount < 1 ? "low" : "in_stock",
    minStockAmount: typeof product.min_stock_amount === "number" ? product.min_stock_amount : undefined,
    quantityUnitPurchaseId: asString(product.qu_id_purchase),
    quantityUnitStockId: asString(product.qu_id_stock),
    notes,
  };
}

function mapGrocyShoppingListRecord(raw: unknown): GrocyShoppingListRecord {
  const record = (raw ?? {}) as Record<string, unknown>;
  const product = (record.product ?? {}) as Record<string, unknown>;
  const doneValue = record.done ?? record.completed ?? record.bought;
  return {
    itemId: asString(record.id) ?? "unknown-item",
    productId: asString(record.product_id) ?? asString(product.id),
    productName: asString(record.product_name) ?? asString(product.name) ?? asString(record.note) ?? "Unknown item",
    quantity: asString(record.amount),
    quantityNumeric: typeof record.amount === "number" ? record.amount : undefined,
    quantityUnitId: asString(record.qu_id),
    note: asString(record.note),
    done: doneValue === true || doneValue === 1 || doneValue === "1",
  };
}

function mapGrocyProductRecord(raw: unknown): GrocyProductRecord {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    productId: asString(record.id) ?? "unknown-product",
    productName: asString(record.name) ?? "Unknown product",
    minStockAmount: asString(record.min_stock_amount),
    quantityUnitPurchaseId: asString(record.qu_id_purchase),
    quantityUnitStockId: asString(record.qu_id_stock),
    defaultBestBeforeDays: asString(record.default_best_before_days),
    dueType: asString(record.due_type),
    note: asString(record.description),
  };
}

export function createGrocyLiveReadSurface(config: GrocyLiveConfig, fetchImpl: typeof fetch = fetch) {
  return {
    async listStock(): Promise<GrocyStockRecord[]> {
      return (await fetchGrocyJson<unknown[]>(config, "/stock", fetchImpl)).map(mapGrocyStockRecord);
    },
    async listShoppingList(input?: { includeCompleted?: boolean }): Promise<GrocyShoppingListRecord[]> {
      const records = (await fetchGrocyJson<unknown[]>(config, "/objects/shopping_list", fetchImpl)).map(mapGrocyShoppingListRecord);
      return input?.includeCompleted ? records : records.filter((record) => !record.done);
    },
    async listProducts(): Promise<GrocyProductRecord[]> {
      return (await fetchGrocyJson<unknown[]>(config, "/objects/products", fetchImpl)).map(mapGrocyProductRecord);
    },
  };
}

export function createGrocyConfigReadSurface(config: GrocyLiveConfig, fetchImpl: typeof fetch = fetch) {
  return {
    async listObjects(entity: GrocyConfigEntity): Promise<GrocyObjectRecord[]> {
      return (await fetchGrocyJson<unknown[]>(config, `/objects/${entity}`, fetchImpl)).map((record) =>
        mapGrocyObjectRecord(entity, record),
      );
    },
    async getSystemInfo(): Promise<Record<string, unknown> | undefined> {
      try {
        return await fetchGrocyJson<Record<string, unknown>>(config, "/system/info", fetchImpl);
      } catch {
        return undefined;
      }
    },
  };
}

export function createGrocyConfigWriteSurface(config: GrocyLiveConfig, fetchImpl: typeof fetch = fetch) {
  return {
    async createObject(entity: GrocyConfigEntity, fields: Record<string, unknown>): Promise<{ createdObjectId: number }> {
      const response = await sendGrocyJson<{ created_object_id?: number }>(config, `/objects/${entity}`, fetchImpl, {
        method: "POST",
        body: fields,
      });
      if (!response.created_object_id) {
        throw new Error(`Grocy ${entity} creation did not return created_object_id.`);
      }
      return { createdObjectId: response.created_object_id };
    },
    async updateObject(entity: GrocyConfigEntity, id: string, fields: Record<string, unknown>): Promise<void> {
      await sendGrocyJson(config, `/objects/${entity}/${encodeURIComponent(id)}`, fetchImpl, {
        method: "PUT",
        body: fields,
      });
    },
  };
}

export async function runGrocyHealthCheck(
  baseDir: string = process.cwd(),
  fetchImpl: typeof fetch = fetch,
  options: GrocyHealthCheckOptions = {},
): Promise<GrocyHealthCheckResult> {
  const configPath = options.configPath ?? DEFAULT_GROCY_CONFIG_PATH;
  const config = loadGrocyLiveConfig(baseDir, configPath);
  if (!config) {
    return { status: getGrocyConfigStatus(baseDir, configPath) };
  }

  try {
    const grocy = createGrocyLiveReadSurface(config, fetchImpl);
    const [stock, shoppingList, products] = await Promise.all([
      grocy.listStock(),
      grocy.listShoppingList(),
      grocy.listProducts(),
    ]);
    return {
      status: {
        toolId: "grocy",
        reachable: true,
        mode: "write_enabled",
        notes: [`Grocy live adapter is reachable at ${config.baseUrl}.`],
      },
      stockCount: stock.length,
      shoppingListCount: shoppingList.length,
      productCount: products.length,
    };
  } catch (error) {
    return {
      status: {
        toolId: "grocy",
        reachable: false,
        mode: "write_enabled",
        notes: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}
