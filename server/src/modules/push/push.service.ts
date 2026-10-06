import webpush from 'web-push';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { PushSubscription } from './push.model';

export const pushEnabled = () => Boolean(env.vapid.publicKey && env.vapid.privateKey);

let configured = false;
const configure = () => {
  if (configured || !pushEnabled()) return;
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
  configured = true;
};

export interface PushPayload {
  title: string;
  body?: string;
  url?: string; // path inside the app, e.g. /classes/123
  tag?: string; // same tag replaces an older notification
  urgent?: boolean;
}

const subscribe = async (
  userId: Types.ObjectId,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) => {
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    { user: userId, endpoint: sub.endpoint, keys: sub.keys, userAgent: userAgent?.slice(0, 300) },
    { upsert: true, new: true },
  );
};

const unsubscribe = (userId: Types.ObjectId, endpoint: string) =>
  PushSubscription.deleteOne({ user: userId, endpoint });

/** Fire-and-forget push to many users. Expired subscriptions are cleaned up automatically. */
const sendToUsers = async (userIds: (string | Types.ObjectId)[], payload: PushPayload) => {
  if (!pushEnabled() || !userIds.length) return { sent: 0 };
  configure();
  const subs = await PushSubscription.find({ user: { $in: userIds } }).lean();
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, {
          TTL: 60 * 60 * 24,
          urgency: payload.urgent ? 'high' : 'normal',
        });
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: s._id });
      }
    }),
  );
  return { sent };
};

const countForUser = (userId: Types.ObjectId) => PushSubscription.countDocuments({ user: userId });

export const PushService = { subscribe, unsubscribe, sendToUsers, countForUser };
