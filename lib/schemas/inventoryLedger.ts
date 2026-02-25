import { z } from 'zod';

export const MovementTypeSchema = z.enum([
  'INVENTORY_INIT',
  'INBOUND',
  'OUTBOUND',
  'OUTBOUND_CANCEL',
  'DISPOSAL',
  'DAMAGE',
  'RETURN_B2C',
  'ADJUSTMENT_PLUS',
  'ADJUSTMENT_MINUS',
  'BUNDLE_BREAK_IN',
  'BUNDLE_BREAK_OUT',
  'EXPORT_PICKUP',
  'TRANSFER',
]);

export const DirectionSchema = z.enum(['IN', 'OUT']);

const movementDirectionMap: Record<z.infer<typeof MovementTypeSchema>, z.infer<typeof DirectionSchema> | null> = {
  INVENTORY_INIT: 'IN',
  INBOUND: 'IN',
  OUTBOUND: 'OUT',
  OUTBOUND_CANCEL: 'IN',
  DISPOSAL: 'OUT',
  DAMAGE: 'OUT',
  RETURN_B2C: 'IN',
  ADJUSTMENT_PLUS: 'IN',
  ADJUSTMENT_MINUS: 'OUT',
  BUNDLE_BREAK_IN: 'IN',
  BUNDLE_BREAK_OUT: 'OUT',
  EXPORT_PICKUP: 'OUT',
  TRANSFER: null,
};

export const LedgerMovementInputSchema = z
  .object({
    tenantId: z.string().uuid(),
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
