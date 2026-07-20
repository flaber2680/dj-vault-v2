export const HERO_STRANDS = {
  colors: ["#F5F7FA", "#9FB7C8"],
  dpr: 1.5,
  strandCount: 2,
  speed: 0.24,
  mobileBreakpoint: 900,
} as const;

export type HeroStrandsEnvironment = {
  viewportWidth: number;
  prefersReducedMotion: boolean;
  supportsWebgl2: boolean;
};

export function isHeroStrandsEnabled({
  viewportWidth,
  prefersReducedMotion,
  supportsWebgl2,
}: HeroStrandsEnvironment) {
  return (
    viewportWidth > HERO_STRANDS.mobileBreakpoint &&
    !prefersReducedMotion &&
    supportsWebgl2
  );
}
