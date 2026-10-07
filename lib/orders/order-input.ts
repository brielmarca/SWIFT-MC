import { z } from "zod";

import { getRank } from "@/data/ranks";

const minecraftUsernamePattern = /^[\p{L}\p{N}_ .#-]+$/u;

const createOrderSchema = z.object({
  rankSlug: z.string().trim().min(1).max(32),
  minecraftUsername: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(minecraftUsernamePattern),
  email: z.string().trim().toLowerCase().max(254).email(),
});

export type CreateOrderInput = {
  rankSlug: string;
  minecraftUsername: string;
  email: string;
};

export type ValidatedOrderInput = {
  rank: NonNullable<ReturnType<typeof getRank>>;
  minecraftUsername: string;
  email: string;
};

export type OrderInputError = "INVALID_INPUT" | "UNKNOWN_RANK";

export function validateOrderInput(
  input: unknown,
): { data: ValidatedOrderInput; error?: never } | { data?: never; error: OrderInputError } {
  const result = createOrderSchema.safeParse(input);

  if (!result.success) {
    return { error: "INVALID_INPUT" };
  }

  const rank = getRank(result.data.rankSlug);

  if (!rank) {
    return { error: "UNKNOWN_RANK" };
  }

  return {
    data: {
      rank,
      minecraftUsername: result.data.minecraftUsername,
      email: result.data.email,
    },
  };
}
