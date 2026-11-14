// Alert.alert has no buttons on web, so the browser's own dialog stands in. Exports match
// confirm.ts.
export function confirm(title: string, message: string, confirmLabel: string) {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
