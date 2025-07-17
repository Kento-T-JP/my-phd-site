import axios from 'axios';
import * as cheerio from 'cheerio';

export function validateJfaUrl(url: string) {
  return url.startsWith('https://www.jfa.jp/samuraiblue/') && url.endsWith('member.html');
}

export async function scrapeJfaPlayers(url: string) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const players: { name: string; number?: number; image?: string; position: string[] }[] = [];

  const titleSpan = $('.outer-block.pankz .pankz-list span').eq(2);
  const title = titleSpan.find('a').text().trim() || titleSpan.text().trim();

  $('.section-block').each((_, block) => {
    const posGroup = $(block).find('h4').first().text().trim();
    $(block)
      .find('.competition-member ul li')
      .each((_, li) => {
        const nameLine = $(li).find('.name').text().trim();
        if (!nameLine) return;

        const match = nameLine.match(/^(\d+)\s*[　 ]?(.*)$/);
        const number = match ? parseInt(match[1], 10) : undefined;
        const name = match ? match[2].trim() : nameLine;

        let image = $(li).find('img').attr('src') || '';
        if (image.startsWith('//')) {
          image = 'https:' + image;
        } else if (image.startsWith('/')) {
          image = 'https://www.jfa.jp' + image;
        }

        players.push({
          name,
          number,
          image,
          position: [posGroup],
        });
      });
  });

  return { players, title };
}
