import { open as openExternal } from '@tauri-apps/api/shell';

const isTauri = () => {
  return typeof window !== 'undefined' &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
};

export async function openLink(url: string, useDefaultBrowser: boolean): Promise<void> {
  if (useDefaultBrowser && isTauri()) {
    await openExternal(url);
    return;
  }

  window.open(url, '_blank');
}
