export const adminSections = [
  "collections",
  "users",
  "promo-codes",
  "downloads",
] as const;

export type AdminSection = (typeof adminSections)[number];

type AdminViewParams = {
  section?: string;
  collection?: string;
  user?: string;
};

type IdentifiedCollection = { number: string };
type IdentifiedUser = { id: string };

export function getAdminViewState<
  Collection extends IdentifiedCollection,
  User extends IdentifiedUser,
>(
  params: AdminViewParams,
  collections: Collection[],
  users: User[],
) {
  const section = adminSections.includes(params.section as AdminSection)
    ? (params.section as AdminSection)
    : "collections";

  return {
    section,
    collection:
      section === "collections"
        ? collections.find((item) => item.number === params.collection)
        : undefined,
    isNewCollection:
      section === "collections" && params.collection === "new",
    user:
      section === "users"
        ? users.find((item) => item.id === params.user)
        : undefined,
  };
}
