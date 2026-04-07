import { z } from 'zod';
import {
  INVENTORY_MOVEMENT_DIRECTION_MAP,
  INVENTORY_MOVEMENT_TYPES,
  type InventoryMovementType,
} from '@/lib/inventory-definitions';

export const MovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPES);

export const DirectionSchema = z.enum(['IN', 'OUT']);

const movementDirectionMap: Record<InventoryMovementType, z.infer<typeof DirectionSchema> | null> =
  INVENTORY_MOVEMENT_DIRECTION_MAP;

export const LedgerMovementInputSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    warehouseId: z.string().uuid(),
    productId: z.string().uuid(),
    movementType: MovementTypeSchema,
    direction: DirectionSchema.optional(),
    quantity: z.number().int().nonnegative(),
    referenceType: z.string().max(64).nullable().optional(),
    referenceId: z.string().uuid().nullable().optional(),
    memo: z.string().max(1000).nullable().optional(),
    idempotencyKey: z.string().max(128).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'quantity는 0보다 커야 합니다.',
        path: ['quantity'],
      });
    }

    const expectedDirection = movementDirectionMap[value.movementType];
    if (expectedDirection && value.direction && expectedDirection !== value.direction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `movementType ${value.movementType}는 direction ${expectedDirection} 이어야 합니다.`,
        path: ['direction'],
      });
    }
  });

export type LedgerMovementInput = z.infer<typeof LedgerMovementInputSchema>;
