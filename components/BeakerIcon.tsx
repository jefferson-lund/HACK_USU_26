import Svg, { Path } from 'react-native-svg';

export default function BeakerIcon({ size = 24, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3V7.5L5 17C4.5 18 4.5 19 5 20C5.5 21 6.5 21.5 8 21.5H16C17.5 21.5 18.5 21 19 20C19.5 19 19.5 18 19 17L15 7.5V3M9 3H15M9 3H7M15 3H17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 14H16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
