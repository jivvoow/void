/**
 * VOID | 훌훌 — design tokens.
 * Every color / radius / font used by the UI should come from here.
 */
export const palette = {
  dusk: '#77758F',
  lavender: '#B9A8C8',
  blush: '#E9BDC1',
  peach: '#F7DCCB',
  cloud: '#F8F0EB',

  ink: '#5E5A72', // soft dark for small text on light surfaces
  inkSoft: '#8A859C',
  white: '#FFFFFF',
  coral: '#F2A3A0',
  pinkGlow: '#F6C3C8',
} as const;

/** Background sky, top → bottom. Matches the dusky-lavender → peach mockup. */
export const skyGradient = {
  base: ['#7C7993', '#9C93AE', '#C6B2C6', '#E9C9C8', '#F7DCCB'] as const,
  baseLocations: [0, 0.28, 0.55, 0.8, 1] as const,
  /** Warmer overlay used while venting (Phase 2 drives its opacity by intensity). */
  warm: ['#857492', '#B28FA6', '#E3A9B2', '#F3C3BC', '#F7D6C8'] as const,
  /** Cooler, slightly deeper overlay for the fade moment. */
  hush: ['#6E6C87', '#8C86A3', '#B3A6C0', '#D9C3CB', '#EFD5CC'] as const,
};

export const cloudColors = {
  bodyHighlight: '#FFFFFF',
  bodyMid: '#FBF3F1',
  bodyEdge: '#E6D8E6',
  bodyShade: '#D6C6DA',
  pinkHighlight: '#FFF1F1',
  pinkMid: '#FBD3D6',
  pinkEdge: '#F0AEB7',
  face: '#6B6480',
  cheek: '#F2B3BC',
  shadow: '#6E6486',
  glow: '#FFF4EE',
} as const;

export const glass = {
  fill: 'rgba(255, 255, 255, 0.22)',
  fillStrong: 'rgba(255, 255, 255, 0.34)',
  border: 'rgba(255, 255, 255, 0.55)',
  borderSoft: 'rgba(255, 255, 255, 0.32)',
} as const;

export const fonts = {
  /** Handwriting display face – prompts, the venting text, pills. */
  hand: 'Gaegu_400Regular',
  handBold: 'Gaegu_700Bold',
  /**
   * Small UI copy (settings, captions) uses the platform Korean face
   * (Apple SD Gothic Neo / Noto Sans KR): most legible at small sizes and adds 0 MB.
   */
  body: undefined as string | undefined,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  gutter: 20,
} as const;

export const textShadow = {
  textShadowColor: 'rgba(90, 80, 120, 0.28)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;
