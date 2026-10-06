import bcrypt from 'bcryptjs';
import { studentIdKey } from '../../utils/helpers';
import { HydratedDocument, Model, Schema, Types, model } from 'mongoose';

export const USER_ROLES = ['teacher', 'student', 'admin'] as const;
export const TEACHER_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type TeacherStatus = (typeof TEACHER_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  name: string;
  email?: string; // required for new accounts (Gmail by default)
  password: string;
  employeeId?: string; // teachers: staff / employee ID checked by the admin
  teacherStatus?: TeacherStatus; // teachers: admin approval
  reviewNote?: string; // reason shown to a rejected teacher
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  role: UserRole;
  studentId?: string; // register ID, as typed (uppercased)
  studentKey?: string; // letters+digits only, for matching "CSE-221 045" == "cse221045"
  institution?: string;
  department?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
      required: [
        function requiredForTeachers(this: { role: UserRole }) {
          return this.role !== 'student';
        },
        'Email is required',
      ],
    },
    password: { type: String, required: true, select: false, minlength: 6 },
    employeeId: { type: String, trim: true, uppercase: true, maxlength: 40 },
    teacherStatus: { type: String, enum: TEACHER_STATUSES },
    reviewNote: { type: String, trim: true, maxlength: 300 },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: USER_ROLES, required: true },
    studentId: { type: String, trim: true, uppercase: true },
    studentKey: { type: String, unique: true, sparse: true, select: false },
    institution: { type: String, trim: true, maxlength: 120 },
    department: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.pre('save', function setStudentKey() {
  if (this.isModified('studentId')) this.studentKey = this.studentId ? studentIdKey(this.studentId) : undefined;
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser, UserModel>('User', userSchema);
