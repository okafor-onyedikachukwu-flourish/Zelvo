import { Image, View } from 'react-native';
import { GRID, PAGE, gridShape, rowPosition } from '../lib/sheet/layout';
import { colors, radius } from './theme';

/**
 * Shows one question's row, cut from a straightened page image (the image covers the whole A4 page,
 * so millimetre positions from the layout map straight onto it).
 */
export function QuestionCrop({
  uri,
  indexOnPage,
  optionCount,
  width,
}: {
  uri: string;
  indexOnPage: number;
  optionCount: number;
  width: number;
}) {
  const shape = gridShape(optionCount);
  const { x, centreY } = rowPosition(indexOnPage, shape);
  const x0 = x - 1.5;
  const x1 = x + shape.columnWidth - GRID.columnGap + 1.5;
  const y0 = centreY - 4.5;
  const y1 = centreY + 4.5;
  const scale = width / (x1 - x0);
  return (
    <View
      style={{
        width,
        height: (y1 - y0) * scale,
        overflow: 'hidden',
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#fff',
      }}
    >
      <Image
        source={{ uri }}
        style={{ position: 'absolute', left: -x0 * scale, top: -y0 * scale, width: PAGE.width * scale, height: PAGE.height * scale }}
      />
    </View>
  );
}
