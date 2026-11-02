import { prisma } from "@/lib/prisma";
import { businessDayKey } from "@/lib/business-day";
import {
  CommercialSaleType,
  LedgerEntryType,
  Prisma,
  RefType,
  TxnType,
} from "@/generated/client";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/lib/errors";
import { PERMISSIONS, SCOPES } from "@/lib/permissions";
import {
  assertCanAccessRecord,
  resolveScope,
  scopeFilter,
  type Actor,
} from "@/lib/access-scope";
import type {
  CreateDomSaleInput,
  UpdateDomSaleInput,
  DomSaleQuery,
} from "./dom-sale.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const domSaleInclude = {
  customer: true,
  fieldStaff: { select: { id: true, name: true, username: true } },
  items: {
    include: {
      product: true,
      stock: true,
    },
  },
} as const;

/**
 * Who can be named as the field staff on a domestic sale: an active user who is
 * allowed to make one. Shared by the guard and the dropdown, so the form never
 * offers someone the server would refuse. A system role holds every permission
 * without a row for it, so it is matched on the flag.
 */
const fieldStaffWhere = {
  isActive: true,
  isDeleted: false,
  userRoles: {
    some: {
      role: {
        OR: [
          { isSystem: true },
          {
            rolePermissions: {
              some: { permission: { code: PERMISSIONS.DOMESTIC_SALE_CREATE } },
            },
          },
        ],
      },
    },
  },
} satisfies Prisma.UserWhereInput;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Whose sales these are is decided by the field staff a sale belongs to — not
 * by who typed it in, since the office records rounds for field staff.
 */
export type DomSaleActor = Actor;

type StockInfo = { productId: number; batchNo: string; quantity: number };
type ProductQty = { productId: number; quantity: number };

// Prisma-inferred item shape from domSaleInclude
type OriginalSaleItem = {
  stockId: number | null;
  productId: number | null;
  quantity: number;
  cylindersDispatched: number;
  emptiesCollected: number;
};


// =============================================================================
// PURE HELPERS
// =============================================================================

function computeTotals(
  items: CreateDomSaleInput["items"],
  discount = 0,
): { totalAmount: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.salePrice * 100) / 100,
    0,
  );
  return { totalAmount: Math.round((subtotal - discount) * 100) / 100 };
}

function generateTrNo(saleId: number): string {
  // India time: toISOString() is UTC, which dated a 02:00 sale the day before
  const date = businessDayKey(new Date()).replace(/-/g, "");
  return `DOM-${date}-${String(saleId).padStart(5, "0")}`;
}

// Builds { productId -> total qty } from new items using stockMap
function resolveProductQtys(
  items: CreateDomSaleInput["items"],
  stockMap: Map<number, StockInfo>,
): ProductQty[] {
  const acc: Record<number, number> = {};
  for (const item of items) {
    const productId = stockMap.get(item.stockId)!.productId;
    acc[productId] = (acc[productId] ?? 0) + item.quantity;
  }
  return Object.entries(acc).map(([productId, quantity]) => ({
    productId: Number(productId),
    quantity,
  }));
}

function toProductQtys(acc: Map<number, number>): ProductQty[] {
  return [...acc]
    .filter(([, quantity]) => quantity !== 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

/** Empties brought back to the godown on refill lines, per product. */
function resolveEmpties(
  items: CreateDomSaleInput["items"],
  stockMap: Map<number, StockInfo>,
): ProductQty[] {
  const collected = new Map<number, number>();

  for (const item of items) {
    const productId = stockMap.get(item.stockId)!.productId;
    collected.set(
      productId,
      (collected.get(productId) ?? 0) + item.emptiesCollected,
    );
  }

  return toProductQtys(collected);
}

/**
 * What an old, customer-linked sale did to that customer's holding, read from
 * what each line recorded. Only those sales moved custody — a domestic sale is
 * now a field staff member's round and has no customer to hold anything.
 * Sales from before custody was tracked at all recorded 0 for both, so
 * reversing one leaves the holding alone.
 */
function resolveOriginalCustody(items: OriginalSaleItem[]): ProductQty[] {
  const net = new Map<number, number>();

  for (const item of items) {
    if (!item.productId) continue;
    net.set(
      item.productId,
      (net.get(item.productId) ?? 0) +
        item.cylindersDispatched -
        item.emptiesCollected,
    );
  }

  return toProductQtys(net);
}

// =============================================================================
// GUARDS
// =============================================================================

async function assertDomSaleExists(tx: Prisma.TransactionClient, id: number) {
  const sale = await tx.domSale.findFirst({
    where: { id, isDeleted: false },
    include: domSaleInclude,
  });
  if (!sale) throw new NotFoundError(`Domestic sale #${id} not found`);
  return sale;
}

// Validates each stock batch has enough qty and returns a stockMap
// Groups by stockId so multiple items from the same batch are checked together
async function assertAndFetchStocks(
  tx: Prisma.TransactionClient,
  items: CreateDomSaleInput["items"],
): Promise<Map<number, StockInfo>> {
  const qtyByStock = items.reduce<Record<number, number>>((acc, item) => {
    acc[item.stockId] = (acc[item.stockId] ?? 0) + item.quantity;
    return acc;
  }, {});

  const stockMap = new Map<number, StockInfo>();

  for (const [stockId, requestedQty] of Object.entries(qtyByStock)) {
    const stock = await tx.stock.findFirst({
      where: { id: Number(stockId), isDeleted: false },
    });

    if (!stock || !stock.productId) {
      throw new NotFoundError(`Stock batch #${stockId} not found`);
    }

    if (stock.quantity < requestedQty) {
      throw new ConflictError(
        `Insufficient quantity in batch "${stock.batchNo}"`,
        {
          stockId: Number(stockId),
          batchNo: stock.batchNo,
          available: stock.quantity,
          requested: requestedQty,
        },
      );
    }

    stockMap.set(Number(stockId), {
      productId: stock.productId,
      batchNo: stock.batchNo,
      quantity: stock.quantity,
    });
  }

  return stockMap;
}

async function customerHoldings(
  tx: Prisma.TransactionClient,
  customerId: number,
): Promise<Map<number, number>> {
  const ledgers = await tx.customerCylinderLedger.findMany({
    where: { customerId },
    select: { productId: true, pendingCylinder: true },
  });
  return new Map(ledgers.map((l) => [l.productId, l.pendingCylinder]));
}

async function productName(tx: Prisma.TransactionClient, productId: number) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { name: true },
  });
  return product?.name ?? `product #${productId}`;
}

/**
 * The field staff a sale is recorded against. Someone who sees every field
 * staff's sales picks one; everyone else is recorded as themselves, and asking
 * for somebody else is refused rather than quietly overridden — a field staff
 * member must not be able to book a round under a colleague's name.
 */
async function resolveFieldStaff(
  tx: Prisma.TransactionClient,
  actor: DomSaleActor,
  requested: number | undefined,
): Promise<number> {
  if (resolveScope(actor, SCOPES.DOMESTIC_SALE) !== "all") {
    if (requested !== undefined && requested !== actor.userId)
      throw new ForbiddenError(
        "You can only record domestic sales you made yourself",
      );
    return actor.userId;
  }

  if (requested === undefined)
    throw new BadRequestError("Select the field staff who made this sale");

  await assertIsFieldStaff(tx, requested);
  return requested;
}

async function assertIsFieldStaff(
  tx: Prisma.TransactionClient,
  userId: number,
) {
  const user = await tx.user.findFirst({
    where: { id: userId, ...fieldStaffWhere },
    select: { id: true },
  });
  if (!user)
    throw new BadRequestError(
      "That user cannot make domestic sales — pick an active field staff member",
    );
  return user;
}

/** Own-scope users may only open or change their own rounds. */
function assertCanAccessSale(
  actor: DomSaleActor,
  sale: { fieldStaffId: number | null },
) {
  assertCanAccessRecord(
    actor,
    resolveScope(actor, SCOPES.DOMESTIC_SALE),
    sale,
    "You can only manage your own domestic sales",
    "fieldStaffId",
  );
}

/**
 * A sale entered before domestic moved to field staff is charged to a
 * customer. Reposting it in the new shape would drop that charge and wipe what
 * the customer still owes on it, so it can only be deleted — which reverses it
 * properly — and entered again.
 */
function assertNotCustomerSale(sale: { customerId: number | null }) {
  if (sale.customerId)
    throw new BadRequestError(
      "This sale was recorded against a customer, before domestic sales moved to field staff. Delete it and enter it again instead of editing it.",
    );
}

/**
 * Reversing an invoice gives back what it did to the holding. If those
 * cylinders have since come back on a later invoice, taking them off again
 * would leave the customer holding a negative number — refuse, and say which
 * invoice has to be corrected first.
 */
async function assertReversalKeepsCustody(
  tx: Prisma.TransactionClient,
  customerId: number,
  net: ProductQty[],
) {
  const held = await customerHoldings(tx, customerId);

  for (const { productId, quantity } of net) {
    if (quantity <= 0) continue;
    const holding = held.get(productId) ?? 0;
    if (holding - quantity < 0)
      throw new ConflictError(
        `${await productName(tx, productId)} from this invoice have since been handed back on a later invoice. Correct that one first.`,
        { productId, holding, reversing: quantity },
      );
  }
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// Creates DomSaleItems, decrements Stock.quantity, appends CylinderTransactions
async function writeSaleItems(
  tx: Prisma.TransactionClient,
  domSaleId: number,
  items: CreateDomSaleInput["items"],
  stockMap: Map<number, StockInfo>,
) {
  // 1. DomSaleItem rows — productId derived from stock, not trusted from client.
  //    Each records what went out and what came back.
  await tx.domSaleItem.createMany({
    data: items.map((item) => ({
      domSaleId,
      stockId: item.stockId,
      productId: stockMap.get(item.stockId)!.productId,
      quantity: item.quantity,
      salePrice: item.salePrice,
      netTotal: Math.round(item.quantity * item.salePrice * 100) / 100,
      saleType: item.saleType,
      cylindersDispatched: item.quantity,
      emptiesCollected: item.emptiesCollected,
    })),
  });

  // 2. Decrement Stock.quantity — grouped by stockId
  const qtyByStock = items.reduce<Record<number, number>>((acc, item) => {
    acc[item.stockId] = (acc[item.stockId] ?? 0) + item.quantity;
    return acc;
  }, {});

  for (const [stockId, qty] of Object.entries(qtyByStock)) {
    await tx.stock.update({
      where: { id: Number(stockId) },
      data: { quantity: { decrement: qty } },
    });
  }

  // 3. Full cylinders out — one row per product and kind, since a refill
  //    (RENT_DELIVERY) and an outright sale (SALE_OUT) are different movements
  const outgoing = new Map<string, { productId: number; txnType: TxnType; quantity: number }>();

  for (const item of items) {
    const productId = stockMap.get(item.stockId)!.productId;
    const txnType =
      item.saleType === CommercialSaleType.RENT
        ? TxnType.RENT_DELIVERY
        : TxnType.SALE_OUT;
    const key = `${productId}:${txnType}`;
    const row = outgoing.get(key) ?? { productId, txnType, quantity: 0 };
    row.quantity += item.quantity;
    outgoing.set(key, row);
  }

  await tx.cylinderTransaction.createMany({
    data: [...outgoing.values()].map(({ productId, txnType, quantity }) => ({
      productId,
      txnType,
      filledDelta: -quantity,
      emptyDelta: 0,
      refType: RefType.INVOICE,
      refId: domSaleId,
      notes: `DomSale #${domSaleId}`,
    })),
  });

  // 4. Empties brought back — one row per product
  const collected = resolveEmpties(items, stockMap);

  if (collected.length > 0)
    await tx.cylinderTransaction.createMany({
      data: collected.map(({ productId, quantity }) => ({
        productId,
        txnType: TxnType.CYLINDER_RETURN,
        filledDelta: 0,
        emptyDelta: quantity,
        refType: RefType.INVOICE,
        refId: domSaleId,
        notes: `Empties collected — DomSale #${domSaleId}`,
      })),
    });
}

// Empties brought back arrive in the godown
async function applyGodownEmpties(
  tx: Prisma.TransactionClient,
  collected: ProductQty[],
) {
  for (const { productId, quantity } of collected) {
    await tx.godownInventory.update({
      where: { productId },
      data: { emptyQty: { increment: quantity } },
    });
  }
}

// The holding of a customer on an old, customer-linked sale — reversals only
async function applyDomesticCustody(
  tx: Prisma.TransactionClient,
  customerId: number,
  net: ProductQty[],
  direction: 1 | -1,
) {
  for (const { productId, quantity } of net) {
    const change = direction * quantity;
    await tx.customerCylinderLedger.upsert({
      where: { productId_customerId: { productId, customerId } },
      update: { pendingCylinder: { increment: change } },
      // The guards guarantee a missing row is only ever created by a gain
      create: { customerId, productId, pendingCylinder: Math.max(change, 0) },
    });
  }
}

// Updates GodownInventory.filledQty by direction (+1 restore, -1 deduct)
async function applyGodownDelta(
  tx: Prisma.TransactionClient,
  productQtys: ProductQty[],
  direction: 1 | -1,
) {
  for (const { productId, quantity } of productQtys) {
    await tx.godownInventory.update({
      where: { productId },
      data: { filledQty: { increment: direction * quantity } },
    });
  }
}

// Restores Stock.quantity when reversing a sale (update or delete)
async function restoreStockQuantities(
  tx: Prisma.TransactionClient,
  saleItems: OriginalSaleItem[],
) {
  const qtyByStock = saleItems.reduce<Record<number, number>>((acc, item) => {
    if (!item.stockId) return acc;
    acc[item.stockId] = (acc[item.stockId] ?? 0) + item.quantity;
    return acc;
  }, {});

  for (const [stockId, qty] of Object.entries(qtyByStock)) {
    await tx.stock.update({
      where: { id: Number(stockId) },
      data: { quantity: { increment: qty } },
    });
  }
}

// Reverses the charge an old, customer-linked sale put on the customer: a
// single ADJUSTMENT row, and CustomerBalance comes down by what was unpaid
async function reverseCustomerLedger(
  tx: Prisma.TransactionClient,
  customerId: number,
  domSaleId: number,
  totalAmount: number,
  paidAmount: number,
  userId: number,
) {
  const netCharge = Math.round((totalAmount - paidAmount) * 100) / 100;

  await tx.customerPaymentLedger.create({
    data: {
      customerId,
      entryType: LedgerEntryType.ADJUSTMENT,
      amount: -netCharge,
      refType: RefType.INVOICE,
      refId: domSaleId,
      notes: `Reversal — DomSale #${domSaleId}`,
      createdById: userId,
    },
  });

  await tx.customerBalance.update({
    where: { customerId },
    data: { pendingAmount: { decrement: netCharge } },
  });
}

// Fetches and voids all active CylinderTransactions for a sale
async function reverseCylinderTransactions(
  tx: Prisma.TransactionClient,
  domSaleId: number,
  note: string,
) {
  const originalTxns = await tx.cylinderTransaction.findMany({
    where: {
      refType: RefType.INVOICE,
      refId: domSaleId,
      voidedTxnId: null,
      voidedBy: { none: {} },
    },
  });

  for (const txn of originalTxns) {
    await tx.cylinderTransaction.create({
      data: {
        productId: txn.productId,
        txnType: txn.txnType,
        filledDelta: -txn.filledDelta,
        emptyDelta: -txn.emptyDelta,
        refType: RefType.INVOICE,
        refId: domSaleId,
        voidedTxnId: txn.id,
        notes: note,
      },
    });

    // Undo exactly the godown movement this row caused — filled and empty.
    // This used to be a separate filled-only restore, which would have left
    // behind any empties a refill brought in.
    await tx.godownInventory.update({
      where: { productId: txn.productId },
      data: {
        filledQty: { increment: -txn.filledDelta },
        emptyQty: { increment: -txn.emptyDelta },
      },
    });
  }
}

// =============================================================================
// CREATE
// =============================================================================

export async function createDomSale(
  input: CreateDomSaleInput,
  actor: DomSaleActor,
) {
  const { items, fieldStaffId: requestedStaff, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (totalAmount < 0)
    throw new BadRequestError("Discount cannot be more than the sale total");

  return prisma.$transaction(async (tx) => {
    // 1. Whose round this is
    const fieldStaffId = await resolveFieldStaff(tx, actor, requestedStaff);

    // 2. Validate stock batches + build stockMap { stockId → { productId, batchNo, qty } }
    const stockMap = await assertAndFetchStocks(tx, items);
    const productQtys = resolveProductQtys(items, stockMap);
    const collected = resolveEmpties(items, stockMap);

    // 3. Create sale header. Paid in full at the door: there is no customer
    //    to carry a balance, so nothing goes on the money ledger.
    const sale = await tx.domSale.create({
      data: {
        ...header,
        fieldStaffId,
        totalAmount,
        paidAmount: totalAmount,
        discount: discount ?? null,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });

    // 4. Set trNo now that we have the sale id
    await tx.domSale.update({
      where: { id: sale.id },
      data: { trNo: generateTrNo(sale.id) },
    });

    // 5. DomSaleItems + Stock.quantity-- + CylinderTransactions
    await writeSaleItems(tx, sale.id, items, stockMap);

    // 6. GodownInventory cache — fulls out, empties in
    await applyGodownDelta(tx, productQtys, -1);
    await applyGodownEmpties(tx, collected);

    return tx.domSale.findUniqueOrThrow({
      where: { id: sale.id },
      include: domSaleInclude,
    });
  });
}

/** The people the office can record a round for — the form's dropdown. */
export async function getFieldStaff() {
  return prisma.user.findMany({
    where: fieldStaffWhere,
    select: { id: true, name: true, username: true },
    orderBy: [{ name: "asc" }, { username: "asc" }],
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getDomSales(query: DomSaleQuery, actor: DomSaleActor) {
  const { fieldStaffId, from, to, page, limit } = query;
  const skip = (page - 1) * limit;
  const scope = resolveScope(actor, SCOPES.DOMESTIC_SALE);

  const where = {
    isDeleted: false,
    // Own scope pins the list to this user's rounds; only "all" may narrow to
    // somebody else, and a fieldStaffId sent by an own-scope user is ignored.
    ...scopeFilter(actor, scope, "fieldStaffId"),
    ...(scope === "all" && fieldStaffId && { fieldStaffId }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.domSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: domSaleInclude,
    }),
    prisma.domSale.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getDomSaleById(id: number, actor: DomSaleActor) {
  const sale = await prisma.domSale.findFirst({
    where: { id, isDeleted: false },
    include: domSaleInclude,
  });
  if (!sale) throw new NotFoundError(`Domestic sale #${id} not found`);
  assertCanAccessSale(actor, sale);
  return sale;
}

// =============================================================================
// UPDATE
// Strategy: reverse everything from the original sale, then repost with new data.
// The DomSale row keeps its original id and trNo.
// =============================================================================

export async function updateDomSale(
  id: number,
  input: UpdateDomSaleInput,
  actor: DomSaleActor,
) {
  const { items, fieldStaffId: requestedStaff, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (totalAmount < 0)
    throw new BadRequestError("Discount cannot be more than the sale total");

  return prisma.$transaction(async (tx) => {
    const original = await assertDomSaleExists(tx, id);
    assertCanAccessSale(actor, original);
    assertNotCustomerSale(original);

    // Keeps its field staff unless the office reassigns it
    const fieldStaffId = await resolveFieldStaff(
      tx,
      actor,
      requestedStaff ?? original.fieldStaffId ?? undefined,
    );

    // ── REVERSE PHASE ────────────────────────────────────────────────────────

    // 1. Void original CylinderTransactions and undo their godown movement
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — DomSale #${id} update`,
    );

    // 2. Restore Stock.quantity from original items
    await restoreStockQuantities(tx, original.items);

    // 3. Delete original sale items (child rows, no independent ledger value)
    await tx.domSaleItem.deleteMany({ where: { domSaleId: id } });

    // ── REPOST PHASE ─────────────────────────────────────────────────────────

    // 4. Validate new stock batches + build stockMap
    const stockMap = await assertAndFetchStocks(tx, items);
    const productQtys = resolveProductQtys(items, stockMap);
    const collected = resolveEmpties(items, stockMap);

    // 5. Write corrected items + Stock.quantity-- + CylinderTransactions
    await writeSaleItems(tx, id, items, stockMap);

    // 6. Apply new GodownInventory delta — fulls out, empties in
    await applyGodownDelta(tx, productQtys, -1);
    await applyGodownEmpties(tx, collected);

    // 7. Update sale header in place (keeps original id and trNo)
    return tx.domSale.update({
      where: { id },
      data: {
        ...header,
        fieldStaffId,
        totalAmount,
        paidAmount: totalAmount,
        discount: discount ?? null,
        updatedById: actor.userId,
      },
      include: domSaleInclude,
    });
  });
}

// =============================================================================
// DELETE
// Strategy: same reverse phase as update, then soft-delete the header.
// =============================================================================

export async function deleteDomSale(id: number, actor: DomSaleActor) {
  const userId = actor.userId;

  return prisma.$transaction(async (tx) => {
    const original = await assertDomSaleExists(tx, id);
    assertCanAccessSale(actor, original);
    const originalCustody = resolveOriginalCustody(original.items);

    if (original.customerId)
      await assertReversalKeepsCustody(tx, original.customerId, originalCustody);

    // 1. Void original CylinderTransactions and undo their godown movement
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — DomSale #${id} deleted`,
    );

    // 2. Restore Stock.quantity
    await restoreStockQuantities(tx, original.items);

    // 3. Old, customer-linked sales only: give back what it did to the holding
    if (original.customerId)
      await applyDomesticCustody(tx, original.customerId, originalCustody, -1);

    // 4. …and take its unpaid amount back off the customer's balance
    if (original.customerId) {
      await reverseCustomerLedger(
        tx,
        original.customerId,
        id,
        Number(original.totalAmount),
        Number(original.paidAmount),
        userId,
      );
    }

    // 5. Soft-delete (items stay for audit, sale header hidden from queries)
    return tx.domSale.update({
      where: { id },
      data: { isDeleted: true, updatedById: userId },
    });
  });
}
