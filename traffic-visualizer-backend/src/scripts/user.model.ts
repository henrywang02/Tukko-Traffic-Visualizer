import mongoose, { Document } from 'mongoose';

export interface UserType extends Document {
  username: string;
  email: string;
  password: string;
}

const userSchema = new mongoose.Schema<UserType>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});


//export const User = mongoose.model("User")

export default mongoose.model<UserType>('User', userSchema);
