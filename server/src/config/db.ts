import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (): Promise<void> => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  // users: email became optional (students) and register IDs unique -> make sure the indexes match the schema
  try {
    const { User } = await import('../modules/user/user.model');
    await User.syncIndexes();
    // teachers created before admin approval existed are treated as approved
    await User.updateMany({ role: 'teacher', teacherStatus: { $exists: false } }, { $set: { teacherStatus: 'approved' } });
    const missing = await User.find({
      role: 'student',
      studentId: { $exists: true },
      studentKey: { $exists: false },
    }).select('+studentKey');
    await Promise.all(
      missing.map((u) => {
        u.markModified('studentId');
        return u.save().catch(() => undefined);
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not sync user indexes:', (err as Error).message);
  }
};
