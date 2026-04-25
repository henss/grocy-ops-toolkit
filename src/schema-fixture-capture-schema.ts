import { z } from "zod";
import { GrocyConfigEntitySchema } from "./schemas.js";

export const GrocySchemaCaptureValueKindSchema = z.enum([
  "string",
  "number",
  "boolean",
  "null",
  "object",
  "array",
]);

export const GrocySchemaCapturePresenceSchema = z.enum(["always", "sometimes"]);

export const GrocySchemaCaptureSourceModeSchema = z.enum(["synthetic_fixture", "live_config"]);

export const GrocySchemaCaptureSurfaceSchema = z.enum([
  "system_info",
  "stock",
  "products",
  "product_groups",
  "locations",
  "quantity_units",
  "product_barcodes",
  "shopping_lists",
  "shopping_list",
]);

export const GrocySchemaCaptureFieldSchema = z.object({
  path: z.string().min(1),
  presence: GrocySchemaCapturePresenceSchema,
  kinds: z.array(GrocySchemaCaptureValueKindSchema).min(1),
});

export const GrocySchemaCaptureSurfaceEntrySchema = z.object({
  surface: GrocySchemaCaptureSurfaceSchema,
  endpoint: z.string().min(1),
  status: z.enum(["captured", "missing"]),
  rootKinds: z.array(GrocySchemaCaptureValueKindSchema).min(1),
  entity: GrocyConfigEntitySchema.optional(),
  fields: z.array(GrocySchemaCaptureFieldSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocySchemaFixtureCaptureSchema = z.object({
  kind: z.literal("grocy_schema_fixture_capture"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("schema_only"),
  source: z.object({
    mode: GrocySchemaCaptureSourceModeSchema,
    fixtureId: z.string().min(1).optional(),
    fixtureLabel: z.string().min(1).optional(),
    configPath: z.string().min(1).optional(),
  }),
  summary: z.object({
    capturedSurfaceCount: z.number().int().nonnegative(),
    missingSurfaceCount: z.number().int().nonnegative(),
    fieldCount: z.number().int().nonnegative(),
  }),
  surfaces: z.array(GrocySchemaCaptureSurfaceEntrySchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocySchemaCaptureValueKind = z.infer<typeof GrocySchemaCaptureValueKindSchema>;
export type GrocySchemaCapturePresence = z.infer<typeof GrocySchemaCapturePresenceSchema>;
export type GrocySchemaCaptureSourceMode = z.infer<typeof GrocySchemaCaptureSourceModeSchema>;
export type GrocySchemaCaptureSurface = z.infer<typeof GrocySchemaCaptureSurfaceSchema>;
export type GrocySchemaCaptureField = z.infer<typeof GrocySchemaCaptureFieldSchema>;
export type GrocySchemaCaptureSurfaceEntry = z.infer<typeof GrocySchemaCaptureSurfaceEntrySchema>;
export type GrocySchemaFixtureCapture = z.infer<typeof GrocySchemaFixtureCaptureSchema>;
