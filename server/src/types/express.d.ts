import { UserDocument } from '../modules/user/user.model';
import { ClassroomDocument } from '../modules/class/class.model';
import { MembershipDocument } from '../modules/class/membership.model';

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
      classroom?: ClassroomDocument;
      membership?: MembershipDocument;
    }
  }
}

export {};
