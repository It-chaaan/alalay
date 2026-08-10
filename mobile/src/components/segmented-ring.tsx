import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type RingSegment = { key: string; value: number; color: string };

type Props = {
  segments: RingSegment[];
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  radius?: number;
  children?: ReactNode;
};

export function SegmentedRing({ segments, trackColor, size = 148, strokeWidth = 17, radius: radiusProp, children }: Props) {
  const center = size / 2;
  const radius = radiusProp ?? (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let offset = 0;

  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {total > 0 ? segments.map((segment) => {
        const length = (Math.max(0, segment.value) / total) * circumference;
        const item = <Circle key={segment.key} cx={center} cy={center} r={radius} fill="none" stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" rotation="-90" origin={`${center}, ${center}`} />;
        offset += length;
        return item;
      }) : null}
    </Svg>
    {children ? <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View> : null}
  </View>;
}

export function SegmentedBar({ segments, trackColor, height = 12, accessibilityLabel }: { segments: RingSegment[]; trackColor: string; height?: number; accessibilityLabel?: string }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  return <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height, overflow: 'hidden', flexDirection: 'row', borderRadius: height / 2, backgroundColor: trackColor }}>
    {total > 0 ? segments.filter((segment) => segment.value > 0).map((segment) => <View key={segment.key} style={{ flex: segment.value, backgroundColor: segment.color }} />) : null}
  </View>;
}
