import { Alert } from 'react-native';

/** Asks before something that can't be undone. Resolves true only if confirmed. */
export function confirm(title: string, message: string, confirmLabel: string) {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
