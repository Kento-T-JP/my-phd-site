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

This project uses [Prisma](https://www.prisma.io/) with a local Postgres database. Create a `.env` file with a `DATABASE_URL` pointing to your instance. For example, with Docker:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb?schema=public"
```

### Migrations & seeding

Player data is not stored in the repository. Instead, the seed script
scrapes the [JFA Samurai Blue](https://www.jfa.jp/samuraiblue/) roster and
imports the players into your local database. Set the `JFA_MEMBER_URL`
environment variable to the member page URL. You can pass it inline when
running the seed command:

```bash
JFA_MEMBER_URL=https://www.jfa.jp/samuraiblue/member.html npm run migrate
JFA_MEMBER_URL=https://www.jfa.jp/samuraiblue/member.html npm run seed
```

During CI deployment, run:

```bash
npm run deploy:migrate
```

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


## Editing Players

Use the **選手一覧を編集** link on the home page to view all registered players. Each row in the list has an **編集** link that opens a form pre‑filled with the player's details. Submitting this form sends a request to `/api/players/[id]` to save changes. The same validation as creation is applied and duplicate names will return a 400 error.

## License

This project is licensed under the [MIT License](LICENSE).
