import { Prisma } from "@/generated/client";

export type MovementWithRelations = Prisma.CylinderTransactionGetPayload<{
  include: { product: { select: { id: true; name: true } } };
}>;

export function serializeMovement(movement: MovementWithRelations) {
  return {
    ...movement,
    notes: movement.notes ?? undefined,
    /** Set when this row reverses another — the correction chain. */
    voidedTxnId: movement.voidedTxnId ?? undefined,
  };
}

export function serializeMovements(movements: MovementWithRelations[]) {
  return movements.map(serializeMovement);
}

export type MovementResponse = ReturnType<typeof serializeMovement>;
