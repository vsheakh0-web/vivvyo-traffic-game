import { EnvironmentThemeId } from '../game/types';

export interface EnvironmentThemeSpec {
  id: EnvironmentThemeId;
  name: string;
  subtitle: string;
  shellBgHex: string;
  hudSurfaceHex: string;
  roadSurfaceHex: string;
  roadBorderHex: string;
  roadCenterlineHex: string;
  lotAsphaltHex: string;
  lotGridLineHex: string;
  lotDotHex: string;
  sidewalkBgHex: string;
  bayBgHex: string;
  ambientLightGradient: string;
  isNightMode: boolean;
  headlightBeamOpacity: number;
  obstacleBadgeHex: string;
  obstacleBorderHex: string;
  accentTextClass: string;
}

export const ENVIRONMENT_THEME_IDS: EnvironmentThemeId[] = [
  'MODERN_CITY',
  'SUBURBAN_STREETS',
  'COASTAL_ROADS',
  'INDUSTRIAL_DISTRICT',
  'GREEN_PARK',
  'NIGHTTIME_CITY',
];

export const ENVIRONMENT_THEMES: Record<
  EnvironmentThemeId,
  EnvironmentThemeSpec
> = {
  MODERN_CITY: {
    id: 'MODERN_CITY',
    name: 'Modern City',
    subtitle: 'Downtown Glass & Transit Plaza',
    shellBgHex: '#090D16',
    hudSurfaceHex: '#0F172A',
    roadSurfaceHex: '#1E293B',
    roadBorderHex: '#334155',
    roadCenterlineHex: 'rgba(251, 191, 36, 0.35)',
    lotAsphaltHex: '#0F172A',
    lotGridLineHex: 'rgba(51, 65, 85, 0.55)',
    lotDotHex: '#334155',
    sidewalkBgHex: '#111827',
    bayBgHex: '#1E293B',
    ambientLightGradient:
      'radial-gradient(circle at 50% 18%, rgba(56, 189, 248, 0.12), transparent 70%)',
    isNightMode: false,
    headlightBeamOpacity: 0.2,
    obstacleBadgeHex: '#334155',
    obstacleBorderHex: '#F59E0B',
    accentTextClass: 'text-sky-400',
  },
  SUBURBAN_STREETS: {
    id: 'SUBURBAN_STREETS',
    name: 'Suburban Streets',
    subtitle: 'Warm Brick & Tree-Lined Avenue',
    shellBgHex: '#12100E',
    hudSurfaceHex: '#1C1917',
    roadSurfaceHex: '#292524',
    roadBorderHex: '#57534E',
    roadCenterlineHex: 'rgba(253, 224, 71, 0.38)',
    lotAsphaltHex: '#1C1917',
    lotGridLineHex: 'rgba(87, 83, 78, 0.55)',
    lotDotHex: '#44403C',
    sidewalkBgHex: '#231F1D',
    bayBgHex: '#292524',
    ambientLightGradient:
      'radial-gradient(circle at 30% 15%, rgba(251, 191, 36, 0.14), transparent 70%)',
    isNightMode: false,
    headlightBeamOpacity: 0.18,
    obstacleBadgeHex: '#3F3A36',
    obstacleBorderHex: '#84CC16',
    accentTextClass: 'text-amber-400',
  },
  COASTAL_ROADS: {
    id: 'COASTAL_ROADS',
    name: 'Coastal Roads',
    subtitle: 'Sunlit Boardwalk & Ocean Breeze',
    shellBgHex: '#071318',
    hudSurfaceHex: '#0C222B',
    roadSurfaceHex: '#153440',
    roadBorderHex: '#235366',
    roadCenterlineHex: 'rgba(254, 240, 138, 0.42)',
    lotAsphaltHex: '#0E2730',
    lotGridLineHex: 'rgba(34, 211, 238, 0.22)',
    lotDotHex: '#1E4E5F',
    sidewalkBgHex: '#0F2933',
    bayBgHex: '#163845',
    ambientLightGradient:
      'radial-gradient(circle at 75% 12%, rgba(34, 211, 238, 0.18), transparent 72%)',
    isNightMode: false,
    headlightBeamOpacity: 0.15,
    obstacleBadgeHex: '#1E4E5F',
    obstacleBorderHex: '#22D3EE',
    accentTextClass: 'text-cyan-400',
  },
  INDUSTRIAL_DISTRICT: {
    id: 'INDUSTRIAL_DISTRICT',
    name: 'Industrial District',
    subtitle: 'Cargo Logistics & Steel Dockyard',
    shellBgHex: '#110F0A',
    hudSurfaceHex: '#1C1810',
    roadSurfaceHex: '#272218',
    roadBorderHex: '#524730',
    roadCenterlineHex: 'rgba(245, 158, 11, 0.5)',
    lotAsphaltHex: '#18150E',
    lotGridLineHex: 'rgba(120, 113, 108, 0.45)',
    lotDotHex: '#443C29',
    sidewalkBgHex: '#211C13',
    bayBgHex: '#2B251A',
    ambientLightGradient:
      'radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.15), transparent 70%)',
    isNightMode: false,
    headlightBeamOpacity: 0.32,
    obstacleBadgeHex: '#3B3220',
    obstacleBorderHex: '#F97316',
    accentTextClass: 'text-orange-400',
  },
  GREEN_PARK: {
    id: 'GREEN_PARK',
    name: 'Green Park',
    subtitle: 'Botanical Parkway & Garden Loop',
    shellBgHex: '#07140D',
    hudSurfaceHex: '#0B2116',
    roadSurfaceHex: '#133223',
    roadBorderHex: '#1E4E36',
    roadCenterlineHex: 'rgba(167, 243, 208, 0.35)',
    lotAsphaltHex: '#0D261A',
    lotGridLineHex: 'rgba(52, 211, 153, 0.22)',
    lotDotHex: '#1D4D35',
    sidewalkBgHex: '#0F291D',
    bayBgHex: '#143625',
    ambientLightGradient:
      'radial-gradient(circle at 40% 15%, rgba(52, 211, 153, 0.16), transparent 70%)',
    isNightMode: false,
    headlightBeamOpacity: 0.16,
    obstacleBadgeHex: '#1B4332',
    obstacleBorderHex: '#34D399',
    accentTextClass: 'text-emerald-400',
  },
  NIGHTTIME_CITY: {
    id: 'NIGHTTIME_CITY',
    name: 'Nighttime City',
    subtitle: 'Midnight Metro & Headlight Glow',
    shellBgHex: '#03060C',
    hudSurfaceHex: '#090D1A',
    roadSurfaceHex: '#111827',
    roadBorderHex: '#312E81',
    roadCenterlineHex: 'rgba(129, 140, 248, 0.45)',
    lotAsphaltHex: '#070B14',
    lotGridLineHex: 'rgba(99, 102, 241, 0.26)',
    lotDotHex: '#1E1B4B',
    sidewalkBgHex: '#0B0F1E',
    bayBgHex: '#131A2E',
    ambientLightGradient:
      'radial-gradient(circle at 50% 25%, rgba(129, 140, 248, 0.18), transparent 72%)',
    isNightMode: true,
    headlightBeamOpacity: 0.65,
    obstacleBadgeHex: '#1E1B4B',
    obstacleBorderHex: '#818CF8',
    accentTextClass: 'text-indigo-400',
  },
};

/**
 * Deterministically maps a level number (1..100) to one of the 6 environment themes,
 * or overrides with the player's selected theme if not set to 'AUTO'.
 */
export function getEnvironmentThemeForLevel(
  levelNumber: number,
  preferredTheme: EnvironmentThemeId | 'AUTO' = 'AUTO'
): EnvironmentThemeSpec {
  if (preferredTheme !== 'AUTO' && ENVIRONMENT_THEMES[preferredTheme]) {
    return ENVIRONMENT_THEMES[preferredTheme];
  }
  // Cycle smoothly every 5 levels through the 6 themes so players experience all 6 worlds
  const bucket = Math.floor((Math.max(1, levelNumber) - 1) / 5) % ENVIRONMENT_THEME_IDS.length;
  const themeId = ENVIRONMENT_THEME_IDS[bucket];
  return ENVIRONMENT_THEMES[themeId];
}
