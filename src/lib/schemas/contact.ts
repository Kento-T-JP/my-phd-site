import { z } from 'zod';

/** Shared contact form schema. */
export const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
  token: z.string().optional(),
  honeypot: z.string().optional(),
});

export type ContactForm = z.infer<typeof ContactSchema>;
