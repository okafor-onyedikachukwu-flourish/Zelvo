import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors } from './theme';

/** Simple bars, oldest on the left; the last bar (this week) is orange. */
export function BarChart({ values, labels, height = 120 }: { values: number[]; labels: string[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...values);
  const gap = 6;
  const bar = width > 0 ? (width - gap * (values.length - 1)) / values.length : 0;
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={`Bar chart, ${total} in the last ${values.length} weeks`}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const h = v === 0 ? 3 : Math.max(6, (v / max) * (height - 18));
            const last = i === values.length - 1;
            return (
              <Rect
                key={i}
                x={i * (bar + gap)}
                y={height - h}
                width={bar}
                height={h}
                rx={Math.min(6, bar / 2)}
                fill={v === 0 ? colors.border : last ? colors.accent : colors.primary}
              />
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 11, color: colors.muted }}>{labels[0]}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{labels[labels.length - 1]}</Text>
      </View>
    </View>
  );
}

/** A rounded progress bar. */
export function ProgressBar({ progress, color = colors.accent }: { progress: number; color?: string }) {
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.primarySoft, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: color }} />
    </View>
  );
}
