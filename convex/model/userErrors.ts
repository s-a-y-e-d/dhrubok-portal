import { ConvexError } from "convex/values";

/** Expected, owner-facing mutation failures. Keep this payload free of private data. */
export type UserErrorData = {
  code: string;
  field?: string;
  details?: Record<string, string | number | boolean>;
};

export function userError(code: string, options: Omit<UserErrorData, "code"> = {}): never {
  throw new ConvexError({ code, ...options } satisfies UserErrorData);
}
