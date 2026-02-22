export const CONTACT_CATEGORY_OPTIONS = [
  { value: "Bug", label: "不具合報告" },
  { value: "Feature", label: "機能要望" },
  { value: "General", label: "その他" },
] as const;

export const CONTACT_CATEGORY_VALUES = ["Bug", "Feature", "General"] as const;

export type ContactCategoryCode = (typeof CONTACT_CATEGORY_VALUES)[number];

const CATEGORY_LABEL_MAP: Record<ContactCategoryCode, string> = {
  Bug: "不具合報告",
  Feature: "機能要望",
  General: "その他",
};

const CATEGORY_ENGLISH_LABEL_MAP: Record<ContactCategoryCode, string> = {
  Bug: "Bug Report",
  Feature: "Feature Request",
  General: "General Inquiry",
};

const CATEGORY_LEGACY_REVERSE_MAP: Record<string, ContactCategoryCode> = {
  不具合報告: "Bug",
  機能要望: "Feature",
  その他: "General",
};

export function normalizeContactCategory(
  category: string | null | undefined
): ContactCategoryCode {
  if (!category) return "General";
  if (category === "Bug" || category === "Feature" || category === "General") {
    return category;
  }
  return CATEGORY_LEGACY_REVERSE_MAP[category] ?? "General";
}

export function getContactCategoryLabel(
  category: string | null | undefined
): string {
  const normalized = normalizeContactCategory(category);
  return CATEGORY_LABEL_MAP[normalized];
}

export function getContactCategoryEnglishLabel(
  category: string | null | undefined
): string {
  const normalized = normalizeContactCategory(category);
  return CATEGORY_ENGLISH_LABEL_MAP[normalized];
}
