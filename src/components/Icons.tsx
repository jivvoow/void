import Svg, { Circle, Path } from 'react-native-svg';

const W = '#FFFFFF';
type IconProps = { size?: number; color?: string };

/** Soft flower-shaped gear, as in the mockup. */
export function SettingsIcon({ size = 26, color = W }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.8c1.2 0 1.8 1.5 2.9 1.9 1.1.4 2.6-.3 3.4.5.8.8.1 2.3.5 3.4.4 1.1 1.9 1.7 1.9 2.9s-1.5 1.8-1.9 2.9c-.4 1.1.3 2.6-.5 3.4-.8.8-2.3.1-3.4.5-1.1.4-1.7 1.9-2.9 1.9s-1.8-1.5-2.9-1.9c-1.1-.4-2.6.3-3.4-.5-.8-.8-.1-2.3-.5-3.4C4.8 13.3 3.3 12.7 3.3 11.5S4.8 9.7 5.2 8.6c.4-1.1-.3-2.6.5-3.4.8-.8 2.3-.1 3.4-.5C10.2 4.3 10.8 2.8 12 2.8Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={11.5} r={2.6} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function BoltIcon({ size = 14, color = W }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13.5 2 5 13.5h6L10 22l9-12.5h-6.2L13.5 2Z" fill={color} />
    </Svg>
  );
}

export function LeafIcon({ size = 15, color = W }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20c0-8 5-14 16-15-1 11-7 16-15 15M4 20l8-8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FeatherIcon({ size = 16, color = W }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 4c-7 0-12 5-12 11v5m0-5h6m-6 0c0-6 5-10 12-11-1 6-4 10-9 11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = '#77758F' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
