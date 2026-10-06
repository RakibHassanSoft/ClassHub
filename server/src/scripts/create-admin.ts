/**
 * Creates the first admin (or turns an existing account into an admin).
 *   npm run create-admin -- you@gmail.com "Your Name" yourPassword
 * Uses MONGODB_URI from server/.env.
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../modules/user/user.model';

const run = async () => {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < 6) {
    console.log('Usage: npm run create-admin -- <email> "<full name>" <password (6+ characters)>');
    process.exit(1);
  }
  await mongoose.connect(env.mongoUri);
  const existing = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (existing) {
    existing.role = 'admin';
    existing.name = name;
    existing.password = password;
    existing.isActive = true;
    existing.studentId = undefined;
    existing.teacherStatus = undefined;
    await existing.save();
    console.log(`${email} is now an admin (password updated).`);
  } else {
    await User.create({ email: email.toLowerCase(), name, password, role: 'admin' });
    console.log(`Admin ${email} created. Log in at /login with this email and password.`);
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
