import type { ObjectId } from "mongodb";
import type { BaseModel } from "../base/base-model";

export interface BaseUser extends BaseModel {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  birthday: Date;
  image?: string;
  cover?: string;
  bio: string;
  city: string;
  adress: string;
  professionalTitle: string;
  postalCode: number;
  phone: string;
  website: string;
  location: string;
  fullName: string;
  coins: number;
  skills?: [ObjectId];
}
