import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const template = process.env.PLAYER_PROFILE_URL;
if (!template || !template.includes('{id}')) {
  console.error('PLAYER_PROFILE_URL env variable must contain {id} placeholder');
  process.exit(1);
}

async function main() {
  const players = await prisma.player.findMany();
  for (const player of players) {
    const profileUrl = template.replace('{id}', String(player.id));
    console.log(`Fetching ${profileUrl}`);
    try {
      const { data: html } = await axios.get(profileUrl);
      const $ = cheerio.load(html);
      let imageUrl = $('meta[property="og:image"]').attr('content') || '';
      if (!imageUrl) {
        const img = $('img').first();
        imageUrl = img.attr('src') || '';
      }
      if (!imageUrl) {
        console.warn(`Image not found for player ${player.id}`);
        continue;
      }
      if (!/^https?:/i.test(imageUrl)) {
        const u = new URL(profileUrl);
        imageUrl = u.origin + imageUrl;
      }
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const ext = path.extname(imageUrl.split('?')[0]) || '.jpg';
      const uploadDir = path.join(process.cwd(), 'public/uploads/players');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${player.id}${ext}`;
      await fs.writeFile(path.join(uploadDir, fileName), response.data);
      await prisma.player.update({
        where: { id: player.id },
        data: { image: `/uploads/players/${fileName}` }
      });
      console.log(`Updated ${player.name}`);
    } catch (err) {
      console.error(`Failed to update player ${player.id}:`, err);
    }
  }
  await prisma.$disconnect();
}

main();
