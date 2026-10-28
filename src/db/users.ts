import { db } from './index.ts';
import { users, audits, driveFiles } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';

export class SqlOwnershipConflict extends Error {
  readonly status = 409;
  constructor() { super('Não foi possível salvar este identificador de auditoria.'); }
}

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:');
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserAudits(uid: string) {
  try {
    const rows = await db
      .select({
        id: audits.id,
        auditId: audits.auditId,
        businessName: audits.businessName,
        city: audits.city,
        overallScore: audits.overallScore,
        classification: audits.classification,
        verified: audits.verified,
        reportJson: audits.reportJson,
        createdAt: audits.createdAt,
      })
      .from(audits)
      .innerJoin(users, eq(audits.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(audits.createdAt));
    return rows;
  } catch (error) {
    console.error('Database query failed in getUserAudits:');
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertUserAudit(
  uid: string,
  email: string,
  payload: {
    auditId: string;
    businessName: string;
    city: string;
    overallScore: number;
    classification: string;
    verified: boolean;
    reportJson?: string;
  }
) {
  try {
    const userRecord = await getOrCreateUser(uid, email);
    const result = await db
      .insert(audits)
      .values({
        userId: userRecord.id,
        auditId: payload.auditId,
        businessName: payload.businessName,
        city: payload.city,
        overallScore: payload.overallScore,
        classification: payload.classification,
        verified: payload.verified ? 'true' : 'false',
        reportJson: payload.reportJson || null,
      })
      .onConflictDoUpdate({
        target: audits.auditId,
        // auditId is globally unique in the existing schema. A conflicting ID
        // must never update a row owned by another account.
        setWhere: eq(audits.userId, userRecord.id),
        set: {
          businessName: payload.businessName,
          city: payload.city,
          overallScore: payload.overallScore,
          classification: payload.classification,
          verified: payload.verified ? 'true' : 'false',
          reportJson: payload.reportJson || null,
        },
      })
      .returning();
    if (!result.length) throw new SqlOwnershipConflict();
    return result[0];
  } catch (error) {
    if (error instanceof SqlOwnershipConflict) throw error;
    console.error('Database query failed in upsertUserAudit:');
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserDriveFiles(uid: string) {
  try {
    const rows = await db
      .select({
        id: driveFiles.id,
        driveFileId: driveFiles.driveFileId,
        fileName: driveFiles.fileName,
        mimeType: driveFiles.mimeType,
        url: driveFiles.url,
        iconUrl: driveFiles.iconUrl,
        businessName: driveFiles.businessName,
        createdAt: driveFiles.createdAt,
      })
      .from(driveFiles)
      .innerJoin(users, eq(driveFiles.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(driveFiles.createdAt));
    return rows;
  } catch (error) {
    console.error('Database query failed in getUserDriveFiles:');
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertUserDriveFile(
  uid: string,
  email: string,
  payload: {
    driveFileId: string;
    fileName: string;
    mimeType: string;
    url: string;
    iconUrl?: string;
    businessName?: string;
  }
) {
  try {
    const userRecord = await getOrCreateUser(uid, email);
    const result = await db
      .insert(driveFiles)
      .values({
        userId: userRecord.id,
        driveFileId: payload.driveFileId,
        fileName: payload.fileName,
        mimeType: payload.mimeType || 'application/octet-stream',
        url: payload.url || '',
        iconUrl: payload.iconUrl || null,
        businessName: payload.businessName || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in insertUserDriveFile:');
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteUserDriveFile(uid: string, recordId: number) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    if (!userRows.length) return false;
    await db
      .delete(driveFiles)
      .where(and(eq(driveFiles.id, recordId), eq(driveFiles.userId, userRows[0].id)));
    return true;
  } catch (error) {
    console.error('Database query failed in deleteUserDriveFile:');
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
