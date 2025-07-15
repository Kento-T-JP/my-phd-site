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

Run the following commands to create the schema and populate initial players:

```bash
npm run migrate
npm run seed
```

During CI deployment, run:

```bash
npm run deploy:migrate
```

## Docker Compose

Build and start the application along with a Postgres database:

```bash
docker compose up --build
```

Migrations are applied automatically when the app container starts. After the
services are running you can seed the database with:

```bash
docker compose exec app npm run seed
```

## Updating player images

Set a `DATABASE_URL` for Prisma and define `PLAYER_PROFILE_URL` with a
template containing `{id}` for each player's profile page. Example:

```dotenv
PLAYER_PROFILE_URL="https://example.com/player/{id}"
```

Run the scraper with:

```bash
npm run update:images
```

The script downloads each player's photo into `public/uploads/players/` and
updates the `image` field in the database.

## Verifying scraping permissions

Before running the scraper, confirm that your chosen data source permits
automated downloads. Check the site's `robots.txt` to ensure scraping the
relevant paths is allowed and review any terms of service for attribution or
other requirements. If the source requires credits, include them where
appropriate in your project.

## License

This project is licensed under the [MIT License](LICENSE).
