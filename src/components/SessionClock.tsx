/**
 * SessionClock — an elapsed-time readout that never re-renders JS.
 *
 * The obvious implementation is `setInterval(() => setState(...), 1000)`. That
 * costs a full React render every second, on every screen showing the clock,
 * for the entire length of a session. On the Now Playing tab that render would
 * sit directly beneath the breath visualizer.
 *
 * Instead the elapsed value is computed inside a frame callback on the UI
 * thread and written into an animated TextInput's `text` prop — the same
 * worklet-text technique BreathPacer uses for its countdown. React renders this
 * component once and never again for the life of the session.
 */

import { TextInput } from 'react-native';
import Animated, {
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type SessionClockProps = {
  /** Epoch ms the session started; null renders a zeroed clock. */
  startedAt: number | null;
  style?: React.ComponentProps<typeof TextInput>['style'];
};

export function SessionClock({ startedAt, style }: SessionClockProps) {
  const elapsed = useSharedValue(0);

  // Runs on the UI thread. Cheap: a subtraction and a divide per frame.
  useFrameCallback(() => {
    'worklet';
    elapsed.value = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  }, true);

  const props = useAnimatedProps(() => {
    'worklet';
    const total = Math.max(0, Math.floor(elapsed.value));
    const m = Math.floor(total / 60);
    const s = total % 60;
    const mm = m < 10 ? `0${m}` : `${m}`;
    const ss = s < 10 ? `0${s}` : `${s}`;
    return { text: `${mm}:${ss}` } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      animatedProps={props}
      defaultValue="00:00"
      style={[
        {
          padding: 0,
          fontFamily: 'Menlo',
          fontVariant: ['tabular-nums'],
          color: '#FFFFFF',
        },
        style,
      ]}
    />
  );
}
