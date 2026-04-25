import fs from "node:fs";
import path from "node:path";
import {
  createGrocyLiveReadSurface,
  loadGrocyLiveConfig,
  type GrocyShoppingListDefinitionRecord,
  type GrocyShoppingListRecord,
} from "./grocy-live.js";
import {
  GrocyShoppingStateExportSchema,
  type GrocyShoppingStateExport,
  type GrocyShoppingStateItem,
  type GrocyShoppingStateList,
} from "./shopping-state-export-schema.js";

export const GROCY_SHOPPING_STATE_EXPORT_PATH = path.join("data", "grocy-shopping-state-export.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function getGeneratedAt(generatedAt?: string): string {
  return generatedAt ?? new Date().toISOString();
}

function createListIndex(lists: GrocyShoppingListDefinitionRecord[]): Map<string, GrocyShoppingStateList> {
  return new Map(lists.map((list) => [list.listId, { listId: list.listId, listName: list.listName }]));
}

function sortLists(lists: GrocyShoppingStateList[]): GrocyShoppingStateList[] {
  return [...lists].sort((left, right) => left.listName.localeCompare(right.listName) || left.listId.localeCompare(right.listId));
}

function sortItems(items: GrocyShoppingStateItem[]): GrocyShoppingStateItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [left.listName ?? "", left.productName, left.itemId];
    const rightKey = [right.listName ?? "", right.productName, right.itemId];
    return leftKey.join("::").localeCompare(rightKey.join("::"));
  });
}

export function createGrocyShoppingStateExport(input: {
  lists: GrocyShoppingListDefinitionRecord[];
  items: GrocyShoppingListRecord[];
  generatedAt?: string;
}): GrocyShoppingStateExport {
  const listIndex = createListIndex(input.lists);
  const lists = sortLists([...listIndex.values()]);
  const items = sortItems(
    input.items.map((item) => {
      const listName = item.listId ? listIndex.get(item.listId)?.listName : undefined;
      return {
        itemId: item.itemId,
        listId: item.listId,
        listName,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        quantityNumeric: item.quantityNumeric,
        quantityUnitId: item.quantityUnitId,
        note: item.note,
        done: item.done,
      };
    }),
  );

  return GrocyShoppingStateExportSchema.parse({
    kind: "grocy_shopping_state_export",
    version: 1,
    generatedAt: getGeneratedAt(input.generatedAt),
    scope: "shopping_lists_read_only",
    source: {
      toolId: "grocy",
      surfaces: ["shopping_lists", "shopping_list"],
    },
    summary: {
      listCount: lists.length,
      itemCount: items.length,
      openItemCount: items.filter((item) => !item.done).length,
      completedItemCount: items.filter((item) => item.done).length,
      productCount: new Set(items.map((item) => item.productId ?? item.productName)).size,
      itemWithListAssignmentCount: items.filter((item) => item.listId).length,
    },
    lists,
    items,
    reviewNotes: [
      "Derived only from the Grocy shopping_lists and shopping_list read surfaces.",
      "Represents current shopping state only; excludes pantry policy, recommendation logic, calendar/task integrations, and private workflow context.",
    ],
  });
}

export async function runGrocyShoppingStateExport(
  baseDir: string = process.cwd(),
  fetchImpl: typeof fetch = fetch,
  options: { generatedAt?: string; configPath?: string } = {},
): Promise<GrocyShoppingStateExport> {
  const config = loadGrocyLiveConfig(baseDir, options.configPath);
  if (!config) {
    throw new Error(`No Grocy live config found at ${path.resolve(baseDir, options.configPath ?? path.join("config", "grocy.local.json"))}.`);
  }

  const grocy = createGrocyLiveReadSurface(config, fetchImpl);
  const [lists, items] = await Promise.all([grocy.listShoppingLists(), grocy.listShoppingList({ includeCompleted: true })]);
  return createGrocyShoppingStateExport({
    lists,
    items,
    generatedAt: options.generatedAt,
  });
}

export function recordGrocyShoppingStateExport(
  shoppingState: GrocyShoppingStateExport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_SHOPPING_STATE_EXPORT_PATH),
    shoppingState,
    options.overwrite ?? true,
  );
}
