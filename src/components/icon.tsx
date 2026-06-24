import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAppTheme } from '@/contexts/theme';
import type { StyleProp, TextStyle } from 'react-native';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Use secondary text color from theme instead of primary */
  secondary?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 22, color, secondary, style }: Props) {
  const t = useAppTheme();
  const c = color ?? (secondary ? t.textSecondary : t.text);
  return <MaterialIcons name={name} size={size} color={c} style={style} />;
}
