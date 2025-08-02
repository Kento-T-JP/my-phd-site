import { z } from 'zod';

/** Shared contact form schema. */
export const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1).max(1000),
  category: z.string().optional(),
  consent: z.boolean(),
  honeypot: z.string().length(0).optional().default(''),
  token: z.string().optional(),
});

export type ContactForm = z.infer<typeof ContactSchema>;
