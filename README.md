This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database setup

This project uses [Prisma](https://www.prisma.io/) with a local Postgres database. Copy `.env.example` to `.env` and set `DATABASE_URL` for your instance. For example, with Docker:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb?schema=public"
```

### Migrations & seeding

Player data is not stored in the repository. Instead, the seed script
scrapes the [JFA Samurai Blue](https://www.jfa.jp/samuraiblue/) roster and
imports the players into your local database. Set the `JFA_MEMBER_URL`
environment variable to the member page URL (add it to your `.env` file or
pass it inline). You can pass it inline when
running the seed command:

```bash
JFA_MEMBER_URL=https://www.jfa.jp/samuraiblue/member.html npm run migrate
JFA_MEMBER_URL=https://www.jfa.jp/samuraiblue/member.html npm run seed
```

### Migrating tournament data

When upgrading from an older schema that stored the tournament name on the
`Player` table, first apply the migrations that create the new `Tournament` and
`Roster` tables:

```bash
npm run deploy:migrate
```

Next run the migration script to copy existing data into the new tables:

```bash
npx tsx scripts/migratePlayersToTournaments.ts
```

After verifying the results, apply the remaining migration to drop the legacy
column:

```bash
npm run deploy:migrate
```

During CI deployment, run:

```bash
npm run deploy:migrate
```

### Optional roster selection

When adding or editing a player, selecting a roster is optional. Leave the roster dropdown blank to associate the player only with the tournament.

## Docker Compose

Build and start the application along with a Postgres database. Pass the
`JFA_MEMBER_URL` variable so the seed script can scrape the roster:

```bash
JFA_MEMBER_URL=https://www.jfa.jp/samuraiblue/member.html docker compose up --build
```

Migrations are applied automatically when the app container starts. After the
services are running you can seed the database again if needed:

```bash
JFA_MEMBER_URL=https://www.jfa.jp/samuraiblue/member.html docker compose exec app npm run seed
```
## Contact form mailer

The contact form sends mail through Gmail using [Nodemailer](https://nodemailer.com/) and dispatches confirmation emails via [Resend](https://resend.com/) or [SendGrid](https://sendgrid.com/). Gmail delivers the notification to your inbox while Resend/SendGrid handles user confirmations.

Install the appropriate mail service client:

```bash
npm install resend
# or
npm install @sendgrid/mail
```

Define the following environment variables in your `.env` file (sample values
are provided in `.env.example`):

- `GMAIL_USER` – Gmail address used to send messages
- `GMAIL_APP_PASSWORD` – 16‑character app password for the Gmail account
- `CONTACT_RECIPIENT` – Address that receives submitted messages
- `RESEND_API_KEY` – API key for Resend (use `SENDGRID_API_KEY` for SendGrid)
- `CONFIRM_FROM_ADDRESS` – Verified sender address for confirmation messages

### Resend/SendGrid setup

1. Create an account and verify a sending domain with Resend or SendGrid.
2. Generate an API key and set `RESEND_API_KEY` or `SENDGRID_API_KEY` in your `.env`.
3. Set `CONFIRM_FROM_ADDRESS` to a verified address from the provider.
4. The application uses Gmail to notify you and Resend/SendGrid to send confirmation messages.

### Gmail app password

When two‑factor authentication is enabled on the Gmail account, you must
generate an app password. In your Google Account settings, navigate to
**Security → App passwords**, create a password for "Mail" and paste the
generated 16‑character value into `GMAIL_APP_PASSWORD`.

### Rate limiting and captcha

The API route applies a simple IP‑based rate limit and supports optional
captcha verification (Google reCAPTCHA or Cloudflare Turnstile) to reduce spam.
Gmail also enforces its own sending limits, so additional protections may be
required for high‑traffic sites.

### Nodemailer setup

```ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
```
## Testing

Before running the test suite, ensure you have Node.js 20 or later installed and install project dependencies:

```bash
npm install
```

Run the tests with:

```bash
npm test
```
(runs `vitest run` under the hood)

### reCAPTCHA for login

To enable Google reCAPTCHA on the login page, set the following environment variables in your `.env` file:

```dotenv
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
```

## Domain Information

- **Domain name:** `start-xi.com`
- **Registrar:** Onamae.com
- **Purchased by:** Kento Totsuka
- **Purpose:** Used for deploying the soccer formation app and sending transactional emails via Resend.
- **Expiration date:** August 4, 2026
- **Nameservers:**
  - 01.dnsv.jp
  - 02.dnsv.jp
  - 03.dnsv.jp
  - 04.dnsv.jp
- **Email setup:**
  - SPF, DKIM, and DMARC records are configured for `send.start-xi.com`
  - Domain verified on [Resend](https://resend.com/) for sending transactional email

**Note:** Please renew the domain before the expiration date to prevent service disruption.



## Editing Players

Use the **選手一覧を編集** link on the home page to view all registered players. Each row in the list has an **編集** link that opens a form pre‑filled with the player's details. Submitting this form sends a request to `/api/players/[id]` to save changes. The same validation as creation is applied and duplicate names will return a 400 error.

## License

This project is licensed under the [MIT License](LICENSE).
