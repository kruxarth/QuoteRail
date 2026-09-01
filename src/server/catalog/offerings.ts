import { rupeesToPaise } from '@/shared/money';
import type { offeringCategorySchema, pricingModelSchema } from '@/shared/schemas';
import type { z } from 'zod';

export type OfferingSeed = {
  code: string;
  name: string;
  description: string;
  category: z.infer<typeof offeringCategorySchema>;
  pricingModel: z.infer<typeof pricingModelSchema>;
  saleRupees: number;
  costRupees: number;
  capacityUnits: number | null;
  capacityLabel: string | null;
  capabilities: string[];
};

export const OFFERING_SEEDS: OfferingSeed[] = [
  {
    code: 'HALL-GRAND',
    name: 'Grand Hall',
    description: 'Flagship six-hour hall for product launches and large theatre seating.',
    category: 'hall',
    pricingModel: 'hall_slot',
    saleRupees: 80_000,
    costRupees: 35_000,
    capacityUnits: 180,
    capacityLabel: '180 guests; one booking per slot',
    capabilities: ['theatre', 'stage', 'product-launch', 'accessible'],
  },
  {
    code: 'HALL-STUDIO',
    name: 'Studio Hall',
    description: 'Compact six-hour hall that seats up to 120 guests.',
    category: 'hall',
    pricingModel: 'hall_slot',
    saleRupees: 55_000,
    costRupees: 25_000,
    capacityUnits: 120,
    capacityLabel: '120 guests; one booking per slot',
    capabilities: ['theatre', 'compact', 'product-launch', 'accessible'],
  },
  {
    code: 'AV-PRO',
    name: 'Professional LED wall and PA',
    description: 'One professional LED wall kit with PA and technician.',
    category: 'av',
    pricingModel: 'fixed',
    saleRupees: 25_000,
    costRupees: 8_000,
    capacityUnits: 1,
    capacityLabel: 'one kit per slot',
    capabilities: ['led-wall', 'professional-pa', 'technician', 'professional_led', 'pa'],
  },
  {
    code: 'AV-STANDARD',
    name: 'Projector and standard PA',
    description: 'Projector and standard PA kit.',
    category: 'av',
    pricingModel: 'fixed',
    saleRupees: 12_000,
    costRupees: 4_000,
    capacityUnits: 2,
    capacityLabel: 'two kits per slot',
    capabilities: ['projector', 'standard-pa', 'pa'],
  },
  {
    code: 'DINNER-PREMIUM',
    name: 'Premium dinner buffet',
    description: 'Premium dinner including Jain and vegan options.',
    category: 'catering',
    pricingModel: 'per_guest',
    saleRupees: 750,
    costRupees: 400,
    capacityUnits: 200,
    capacityLabel: '200 meals per slot',
    capabilities: ['dinner', 'jain', 'vegan', 'vegetarian', 'premium_dinner'],
  },
  {
    code: 'DINNER-STANDARD',
    name: 'Standard dinner buffet',
    description: 'Standard dinner including Jain and vegan options.',
    category: 'catering',
    pricingModel: 'per_guest',
    saleRupees: 550,
    costRupees: 300,
    capacityUnits: 200,
    capacityLabel: '200 meals per slot',
    capabilities: ['dinner', 'jain', 'vegan', 'vegetarian'],
  },
  {
    code: 'VALET-CREW',
    name: 'Valet parking crew',
    description: 'Valet crew covering up to 60 cars.',
    category: 'parking',
    pricingModel: 'fixed',
    saleRupees: 15_000,
    costRupees: 7_000,
    capacityUnits: 1,
    capacityLabel: 'one crew per slot; 60 cars',
    capabilities: ['valet'],
  },
  {
    code: 'STAGE-BRANDED',
    name: 'Branded stage treatment',
    description: 'Branded stage dressing crew.',
    category: 'staging',
    pricingModel: 'fixed',
    saleRupees: 10_000,
    costRupees: 4_000,
    capacityUnits: 1,
    capacityLabel: 'one crew per slot',
    capabilities: ['branded-stage', 'branded_stage'],
  },
  {
    code: 'EVENT-OPS',
    name: 'Event operations and cleaning',
    description: 'Coordinator, cleaning, and security. Mandatory once per booking.',
    category: 'operations',
    pricingModel: 'fixed',
    saleRupees: 8_000,
    costRupees: 3_000,
    capacityUnits: null,
    capacityLabel: 'mandatory once per booking',
    capabilities: ['coordinator', 'cleaning', 'security'],
  },
];

export function offeringSalePaise(code: string): bigint {
  const found = OFFERING_SEEDS.find((item) => item.code === code);
  if (!found) throw new Error(`unknown offering ${code}`);
  return rupeesToPaise(found.saleRupees);
}

export function offeringCostPaise(code: string): bigint {
  const found = OFFERING_SEEDS.find((item) => item.code === code);
  if (!found) throw new Error(`unknown offering ${code}`);
  return rupeesToPaise(found.costRupees);
}

export const RESERVED_OFFERING_CODES = OFFERING_SEEDS.filter(
  (item) => item.capacityUnits !== null,
).map((item) => item.code);
