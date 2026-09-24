export const RETAIL_UNAVAILABLE_ACTIONS = new Set([
  'ITEM_AMENDMENT', 'ITEM_REMOVE', 'ITEM_SUBSTITUTION', 'ITEM_SUBSTITUTION_CATALOG',
]);

export interface RetailOrderContractIssue { path: string; message: string; }

/** Validate only the Channel/Retail fields LT already sends and has staging evidence for. */
export function validateRetailOrderPayload(payload: any): RetailOrderContractIssue[] {
  const issues: RetailOrderContractIssue[] = [];
  const requiredString = (path: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) issues.push({ path, message: 'must be a non-empty string' });
  };
  requiredString('channelOrderId', payload?.channelOrderId);
  requiredString('channelOrderDisplayId', payload?.channelOrderDisplayId);
  requiredString('placedTime', payload?.placedTime);
  if (payload?.orderType !== 1 && payload?.orderType !== 2) issues.push({ path: 'orderType', message: 'must be 1 or 2' });
  if (typeof payload?.deliveryIsAsap !== 'boolean') issues.push({ path: 'deliveryIsAsap', message: 'must be boolean' });
  if (payload?.decimalDigits !== 2) issues.push({ path: 'decimalDigits', message: 'must be 2' });

  const payment = payload?.payment;
  for (const field of ['amount', 'due', 'rebate']) {
    if (!Number.isInteger(payment?.[field]) || payment[field] < 0) {
      issues.push({ path: `payment.${field}`, message: 'must be a non-negative integer minor-unit amount' });
    }
  }
  if (typeof payload?.orderIsAlreadyPaid !== 'boolean') {
    issues.push({ path: 'orderIsAlreadyPaid', message: 'must be boolean' });
  } else if (Number.isInteger(payment?.amount) && Number.isInteger(payment?.due)) {
    const expectedDue = payload.orderIsAlreadyPaid ? 0 : payment.amount;
    if (payment.due !== expectedDue) issues.push({ path: 'payment.due', message: `must be ${expectedDue} when orderIsAlreadyPaid=${payload.orderIsAlreadyPaid}` });
  }

  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    issues.push({ path: 'items', message: 'must contain at least one item' });
  } else payload.items.forEach((item: any, index: number) => {
    const base = `items[${index}]`;
    requiredString(`${base}.plu`, item?.plu);
    requiredString(`${base}.name`, item?.name);
    if (!Number.isInteger(item?.price) || item.price < 0) issues.push({ path: `${base}.price`, message: 'must be a non-negative integer price' });
    if (!Number.isInteger(item?.quantity) || item.quantity < 1) issues.push({ path: `${base}.quantity`, message: 'must be a positive integer' });
    if (!Array.isArray(item?.itemUnavailableActions) || item.itemUnavailableActions.length === 0) {
      issues.push({ path: `${base}.itemUnavailableActions`, message: 'must contain at least one Quest action' });
    } else for (const action of item.itemUnavailableActions) {
      if (!RETAIL_UNAVAILABLE_ACTIONS.has(String(action))) issues.push({ path: `${base}.itemUnavailableActions`, message: `unsupported action "${action}"` });
    }
    if (item?.substituteCandidate !== undefined) {
      if (!Array.isArray(item.substituteCandidate) || item.substituteCandidate.length === 0) {
        issues.push({ path: `${base}.substituteCandidate`, message: 'must be non-empty when supplied' });
      } else item.substituteCandidate.forEach((candidate: any, ci: number) => {
        requiredString(`${base}.substituteCandidate[${ci}].plu`, candidate?.plu);
        requiredString(`${base}.substituteCandidate[${ci}].name`, candidate?.name);
      });
    }
  });
  if (payload?.orderType === 2 && !payload?.deliveryAddress) issues.push({ path: 'deliveryAddress', message: 'is required for delivery orders' });
  return issues;
}

export function assertRetailOrderPayloadContract(payload: any): void {
  const issues = validateRetailOrderPayload(payload);
  if (!issues.length) return;
  const error: any = new Error('Retail order payload failed local contract validation: ' + issues.map(i => `${i.path}: ${i.message}`).join('; '));
  error.code = 'RETAIL_ORDER_CONTRACT_INVALID';
  error.statusCode = 422;
  throw error;
}
