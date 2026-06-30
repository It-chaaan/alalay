import type { User } from "@supabase/supabase-js";

export type AuthedUser = Pick<User, "id" | "email" | "user_metadata">;

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
