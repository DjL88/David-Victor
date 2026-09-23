import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('customer notification isolation regressions', () => {
  const routerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'server/api/v1Router.ts'),
    'utf8'
  );
  const firestoreSource = fs.readFileSync(
    path.resolve(process.cwd(), 'server/firestoreService.ts'),
    'utf8'
  );
  const clientSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/NotificationClient.ts'),
    'utf8'
  );

  it('derives signed-in notification identity from the verified Firebase token', () => {
    expect(routerSource).toContain('const callerUid = await getCallerUid(req)');
    expect(routerSource).toContain('claimedCustomerUid && claimedCustomerUid !== callerUid');
    expect(routerSource).toContain('customerUid: customerUid ? undefined : sessionId');
    expect(clientSource).toContain("import { getCurrentIdToken } from '../firebase'");
    expect(clientSource).toContain('Authorization: `Bearer ${token}`');
  });

  it('never runs a tenant-wide Firestore notification query for a guest session', () => {
    expect(firestoreSource).toContain("query = query.where('sessionId', '==', sessionId)");
    expect(firestoreSource).toContain("query = query.where('recipientSessionId', '==', sessionId)");
    expect(firestoreSource).toContain('if (!db || (!customerUid && !sessionId)) return list;');
  });

  it('checks notification ownership before marking a record as read', () => {
    expect(routerSource).toContain('getNotificationById(notificationId)');
    expect(routerSource).toContain('notification.tenantId !== tenantId');
    expect(routerSource).toContain('notification.recipientUid === callerUid');
    expect(routerSource).toContain('notification.recipientSessionId === sessionId');
  });
});
