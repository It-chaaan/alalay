import { ChevronRight, Code, House, Send, type LucideIcon } from 'lucide-react-native';
import { type StyleProp, type ViewStyle } from 'react-native';

type IconSymbolName = 'house.fill' | 'paperplane.fill' | 'chevron.left.forwardslash.chevron.right' | 'chevron.right';

const MAPPING: Record<IconSymbolName, LucideIcon> = {
  'house.fill': House,
  'paperplane.fill': Send,
  'chevron.left.forwardslash.chevron.right': Code,
  'chevron.right': ChevronRight,
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  strokeWidth = 1.75,
}: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
}) {
  const Icon = MAPPING[name];
  return <Icon color={color} size={size} strokeWidth={strokeWidth} style={style} />;
}
