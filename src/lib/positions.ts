export const ENGLISH_TO_JAPANESE: Record<string, string> = {
  GK: "ゴールキーパー",
  DF: "ディフェンダー",
  MF: "ミッドフィールダー",
  FW: "フォワード",
  LB: "左サイドバック",
  CB: "センターバック",
  RB: "右サイドバック",
  DMF: "守備的ミッドフィールダー",
  CMF: "センターミッドフィールダー",
  OMF: "攻撃的ミッドフィールダー",
  LM: "左ミッドフィールダー",
  RM: "右ミッドフィールダー",
  LW: "左ウイング",
  RW: "右ウイング",
  ST: "ストライカー",
};

export const JAPANESE_TO_ENGLISH: Record<string, string> = Object.fromEntries(
  Object.entries(ENGLISH_TO_JAPANESE).map(([en, ja]) => [ja, en]),
);

function key(str: string): string {
  return str.trim().normalize("NFKC").toLowerCase();
}

const POSITION_ALIASES: Record<string, string> = {
  gk: "GK",
  goalkeeper: "GK",
  ゴールキーパー: "GK",
  df: "DF",
  defender: "DF",
  ディフェンダー: "DF",
  mf: "MF",
  midfielder: "MF",
  ミッドフィールダー: "MF",
  fw: "FW",
  forward: "FW",
  フォワード: "FW",
  lb: "LB",
  "left back": "LB",
  左サイドバック: "LB",
  cb: "CB",
  "center back": "CB",
  "centre back": "CB",
  センターバック: "CB",
  rb: "RB",
  "right back": "RB",
  右サイドバック: "RB",
  cm: "CMF",
  cmf: "CMF",
  "central midfielder": "CMF",
  "central midfield": "CMF",
  センターミッドフィールダー: "CMF",
  dm: "DMF",
  dmf: "DMF",
  "defensive midfielder": "DMF",
  ボランチ: "DMF",
  am: "OMF",
  amf: "OMF",
  "attacking midfielder": "OMF",
  トップ下: "OMF",
  lm: "LM",
  "left midfielder": "LM",
  左ミッドフィールダー: "LM",
  左サイドハーフ: "LM",
  rm: "RM",
  "right midfielder": "RM",
  右ミッドフィールダー: "RM",
  右サイドハーフ: "RM",
  lw: "LW",
  "left wing": "LW",
  左ウイング: "LW",
  rw: "RW",
  "right wing": "RW",
  右ウイング: "RW",
  st: "ST",
  cf: "ST",
  striker: "ST",
  "center forward": "ST",
  "centre forward": "ST",
  センターフォワード: "ST",
};

export function normalizePosition(input: string): string {
  const k = key(input);
  return POSITION_ALIASES[k] || input.trim();
}

export function positionToJapanese(pos: string): string {
  return ENGLISH_TO_JAPANESE[pos] || pos;
}

