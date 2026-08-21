import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import Text from '@/components/ui/Text';
import { color, space } from '@/constants/theme';

export type ScatterPoint = {
  x: number;
  y: number;
  predicted: number;
  date: string;
};

export type FitScatterProps = {
  r2: number;
  data: ScatterPoint[];
};

const WIDTH = 600;
const HEIGHT = 300;
const PAD_X = 48;
const PAD_Y = 28;

function fitSummary(r2: number) {
  const bounded = Math.max(0, Math.min(1, r2));
  const percent = Math.round(bounded * 100);
  const strength = bounded < 0.2 ? 'weak' : bounded <= 0.5 ? 'moderate' : 'strong';
  return `This model explains about ${percent}% of the day-to-day change — a ${strength} fit${
    strength === 'weak' ? ', so treat these as hints.' : '.'
  }`;
}

export function FitScatter({ r2, data }: FitScatterProps) {
  if (data.length === 0) return null;

  const values = data.flatMap((point) => [point.x, point.y]).filter(Number.isFinite);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = Math.floor(rawMin);
  const max = Math.ceil(rawMax);
  const range = max - min || 1;
  const chartWidth = WIDTH - PAD_X * 2;
  const chartHeight = HEIGHT - PAD_Y * 2;
  const xFor = (value: number) =>
    PAD_X + ((Math.max(min, Math.min(max, value)) - min) / range) * chartWidth;
  const yFor = (value: number) =>
    HEIGHT - PAD_Y - ((Math.max(min, Math.min(max, value)) - min) / range) * chartHeight;

  return (
    <View style={styles.wrapper}>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        accessibilityLabel="Predicted ratings compared with actual ratings">
        <Rect
          x={PAD_X}
          y={PAD_Y}
          width={chartWidth}
          height={chartHeight}
          fill={color.surfaceMuted}
          stroke={color.borderStrong}
        />
        <Line
          x1={xFor(min)}
          y1={yFor(min)}
          x2={xFor(max)}
          y2={yFor(max)}
          stroke={color.slateFaint}
          strokeWidth={1}
        />
        {data.map((point, index) => (
          <Circle
            key={`${point.date}-${index}`}
            cx={xFor(point.x)}
            cy={yFor(point.y)}
            r={6}
            fill={color.primaryStrong}
            stroke={color.surface}
            strokeWidth={2}
          />
        ))}
        <SvgText
          x={WIDTH / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          fontSize={12}
          fill={color.textSoft}>
          Actual rating
        </SvgText>
        <SvgText
          x={14}
          y={HEIGHT / 2}
          textAnchor="middle"
          fontSize={12}
          fill={color.textSoft}
          transform={`rotate(-90 14 ${HEIGHT / 2})`}>
          Predicted
        </SvgText>
        <SvgText x={PAD_X} y={HEIGHT - PAD_Y + 18} fontSize={12} fill={color.textSoft}>
          {min}
        </SvgText>
        <SvgText
          x={WIDTH - PAD_X}
          y={HEIGHT - PAD_Y + 18}
          textAnchor="end"
          fontSize={12}
          fill={color.textSoft}>
          {max}
        </SvgText>
      </Svg>
      <Text variant="small" tone="soft">
        {fitSummary(r2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.xs,
  },
});

export default FitScatter;
