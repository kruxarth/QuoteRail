import { z } from 'zod';
import { MAX_REQUEST_CHARS } from '@/shared/constants';

export const offeringCategorySchema = z.enum([
  'hall',
  'av',
  'catering',
  'parking',
  'staging',
  'operations',
]);
export const pricingModelSchema = z.enum(['hall_slot', 'fixed', 'per_guest']);
export const slotWindowSchema = z.enum(['morning', 'afternoon', 'evening']);
export const eventTypeSchema = z.enum([
  'product_launch',
  'conference',
  'workshop',
  'celebration',
  'other',
]);
export const layoutSchema = z.enum(['theatre', 'classroom', 'banquet', 'standing', 'flexible']);
export const parkingPreferenceSchema = z.enum(['valet', 'self', 'either', 'none']);
export const paymentPreferenceSchema = z.enum(['deposit', 'full', 'either']);
export const paymentTermSchema = z.enum(['deposit', 'full']);
export const prioritySchema = z.enum([
  'budget',
  'date',
  'headcount',
  'service_level',
  'space',
  'parking',
]);
export const timePreferenceSchema = z.enum(['morning', 'afternoon', 'evening', 'exact']);

// OpenAI/OpenCode structured output requires every property in `required`.
// Defaults and .optional() omit keys and get rejected as invalid_json_schema.
export const mealRequirementsSchema = z.object({
  total: z.number().int().nonnegative(),
  jain: z.number().int().nonnegative(),
  vegan: z.number().int().nonnegative(),
  vegetarian: z.number().int().nonnegative(),
  other_notes: z.string().max(500),
});

export const extractedRequirementsSchema = z
  .object({
    event_type: eventTypeSchema,
    attendee_count: z.number().int().positive().nullable(),
    budget_subunits: z.number().int().positive().nullable(),
    currency: z.literal('INR'),
    city: z.string().min(1).max(80),
    requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    requested_date_phrase: z.string().max(120),
    time_preference: timePreferenceSchema.nullable(),
    requested_start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    duration_hours: z.number().positive().max(12).nullable(),
    layout: layoutSchema.nullable(),
    required_capabilities: z.array(z.string().max(64)).max(20),
    optional_capabilities: z.array(z.string().max(64)).max(20),
    meal_requirements: mealRequirementsSchema.nullable(),
    parking_preference: parkingPreferenceSchema.nullable(),
    payment_preference: paymentPreferenceSchema.nullable(),
    priorities: z.array(prioritySchema).max(8),
    notes: z.string().max(1000),
    missing_required_fields: z.array(z.string().max(64)).max(20),
    clarification_questions: z.array(z.string().max(300)).max(6),
    requested_additional_discount_bps: z.number().int().min(0).max(10_000),
    suspicious_instruction: z.boolean(),
  })
  .strict();

export type ExtractedRequirements = z.infer<typeof extractedRequirementsSchema>;

export const candidateServiceSchema = z
  .object({
    code: z.string().min(1).max(40),
    quantity: z.number().int().positive().max(500),
  })
  .strict();

export const candidatePlanSchema = z
  .object({
    name: z.string().min(1).max(120),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    duration_hours: z.number().positive().max(12),
    attendee_count: z.number().int().positive().max(500),
    hall_code: z.string().min(1).max(40),
    services: z.array(candidateServiceSchema).max(12),
    meal_allocation: mealRequirementsSchema,
    original_constraints_satisfied: z.array(z.string().max(80)).max(20),
    relaxed_constraints: z
      .array(
        z
          .object({
            constraint: z.string().max(80),
            reason: z.string().max(300),
          })
          .strict(),
      )
      .max(12),
    assumptions: z.array(z.string().max(300)).max(12),
    requested_additional_discount_bps: z.number().int().min(0).max(1_000),
    rationale: z.string().max(800),
  })
  .strict()
  .superRefine((value, ctx) => {
    const forbidden = [
      'unit_price',
      'line_price',
      'subtotal',
      'fees',
      'margin',
      'deposit',
      'total',
      'price',
      'cost',
    ];
    const raw = JSON.stringify(value).toLowerCase();
    for (const key of forbidden) {
      if (
        Object.prototype.hasOwnProperty.call(value, key) ||
        Object.prototype.hasOwnProperty.call(value, `${key}_amount`)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: `candidate must not contain price field ${key}`,
        });
      }
    }
    void raw;
  });

export type CandidatePlan = z.infer<typeof candidatePlanSchema>;

export const candidateSetSchema = z
  .object({
    candidates: z.array(candidatePlanSchema).max(3),
    cannot_proceed: z.boolean(),
    escalation_reason: z.string().max(500),
  })
  .strict();

export type CandidateSet = z.infer<typeof candidateSetSchema>;

export const boundedTextSchema = z.string().trim().min(1).max(MAX_REQUEST_CHARS);

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(120)
  .transform((value) => value.toLowerCase())
  .optional();

export function assertNoPriceFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const banned = new Set([
    'unit_price',
    'line_price',
    'subtotal',
    'fees',
    'margin',
    'deposit_amount',
    'final_total',
    'total_price',
    'sale_price',
    'cost',
    'unit_cost',
  ]);
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (banned.has(key)) {
        throw new Error(`forbidden price field ${path}${key}`);
      }
      walk(child, `${path}${key}.`);
    }
  };
  walk(value, '');
}
