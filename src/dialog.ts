import { Alert, Platform } from 'react-native';

// react-native-web 의 Alert 는 아무것도 띄우지 않으므로 웹(아이폰 웹앱)에서는 브라우저 대화상자를 씀

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmText: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}
