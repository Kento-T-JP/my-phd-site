import { z } from "zod";

export const PlayerSchema = z.object({
  name: z.string().min(1, { message: "名前は必須です" }),
  position: z.array(z.string()).min(1, { message: "ポジションを1つ以上選択してください" }),
  number: z.coerce
    .number()
    .int({ message: "背番号は整数で入力してください" })
    .min(1, { message: "背番号は1以上で入力してください" })
    .optional(),
  wikiUrl: z.string().url().optional(),
  tournament: z.string().optional(),
  tournamentDate: z.string().optional(),
});
