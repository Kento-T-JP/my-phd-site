export const cacheTag = {
  rosters: (userId: number) => `rosters:user:${userId}`,
  rostersTitles: (userId: number) => `rosters-titles:user:${userId}`,
  tournaments: (userId: number) => `tournaments:user:${userId}`,
  tournamentsNames: (userId: number) => `tournaments-names:user:${userId}`,
};

