import { Types } from 'mongoose';
import { AuditEntity, AuditLog, IAuditChange } from './audit.model';

/** Records an entry; never breaks the main request if logging fails. */
export const audit = async (entry: {
  classroom: Types.ObjectId;
  user: Types.ObjectId;
  entity: AuditEntity;
  entityId?: Types.ObjectId;
  action: 'create' | 'update' | 'delete';
  summary: string;
  changes?: IAuditChange[];
}) => {
  try {
    await AuditLog.create({ ...entry, changes: (entry.changes ?? []).slice(0, 500) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Audit log failed:', (err as Error).message);
  }
};

const list = async (classroomId: Types.ObjectId, opts: { entity?: string; before?: string; limit: number }) => {
  const filter: Record<string, unknown> = { classroom: classroomId };
  if (opts.entity) filter.entity = opts.entity;
  if (opts.before) filter.createdAt = { $lt: new Date(opts.before) };
  const items = await AuditLog.find(filter)
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(opts.limit + 1)
    .lean();
  return { items: items.slice(0, opts.limit), hasMore: items.length > opts.limit };
};

export const AuditService = { list };
