import { z } from "zod";

export const GrocyReadmeQuickstartProofCheckSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pass", "fail"]),
  message: z.string().min(1),
});

export const GrocyReadmeQuickstartProofRecipeIdSchema = z.enum([
  "quick_start_preflight",
  "fresh_agent_cold_start_loop",
  "demo_lab_one_command",
]);

export const GrocyReadmeQuickstartProofRecipeSchema = z.object({
  id: GrocyReadmeQuickstartProofRecipeIdSchema,
  title: z.string().min(1),
  status: z.enum(["pass", "fail"]),
  summary: z.string().min(1),
  checks: z.array(GrocyReadmeQuickstartProofCheckSchema).default([]),
  artifactPaths: z.array(z.string().min(1)).default([]),
});

export const GrocyReadmeQuickstartProofArtifactSchema = z.object({
  kind: z.string().min(1),
  path: z.string().min(1),
});

export const GrocyReadmeQuickstartProofReceiptSchema = z.object({
  kind: z.literal("grocy_readme_quickstart_proof_receipt"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  command: z.object({
    id: z.literal("grocy:quickstart:proof"),
    cli: z.literal("npm run grocy:quickstart:proof"),
  }),
  summary: z.object({
    status: z.enum(["pass", "fail"]),
    recipeCount: z.number().int().nonnegative(),
    artifactCount: z.number().int().nonnegative(),
  }),
  recipes: z.array(GrocyReadmeQuickstartProofRecipeSchema).default([]),
  artifacts: z.array(GrocyReadmeQuickstartProofArtifactSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyReadmeQuickstartProofCheck = z.infer<typeof GrocyReadmeQuickstartProofCheckSchema>;
export type GrocyReadmeQuickstartProofRecipeId = z.infer<typeof GrocyReadmeQuickstartProofRecipeIdSchema>;
export type GrocyReadmeQuickstartProofRecipe = z.infer<typeof GrocyReadmeQuickstartProofRecipeSchema>;
export type GrocyReadmeQuickstartProofArtifact = z.infer<typeof GrocyReadmeQuickstartProofArtifactSchema>;
export type GrocyReadmeQuickstartProofReceipt = z.infer<typeof GrocyReadmeQuickstartProofReceiptSchema>;
