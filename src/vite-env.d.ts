/// <reference types="vite/client" />

// Suppress Tauri API errors for dynamically imported modules
// These are only invoked in Tauri context, not in web/worker builds
declare module '@tauri-apps/api/core' {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}