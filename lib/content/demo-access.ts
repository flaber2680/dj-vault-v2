type DemoAccessInput = {
  hasPaidPlan: boolean;
  hasUser: boolean;
  hasArchive: boolean;
};

export type DemoAccessState =
  | "hidden"
  | "unavailable"
  | "register"
  | "download";

export function getDemoAccessState({
  hasPaidPlan,
  hasUser,
  hasArchive,
}: DemoAccessInput): DemoAccessState {
  if (hasPaidPlan) {
    return "hidden";
  }

  if (!hasArchive) {
    return "unavailable";
  }

  return hasUser ? "download" : "register";
}
