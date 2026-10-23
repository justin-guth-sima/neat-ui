/*
 * Public API surface of @sima/neat-ui/toast: error, status and progress toasts, and the host that
 * shows them. A secondary entry point; it imports the primary entry point (`@sima/neat-ui`) by
 * package name, and the primary never imports it. Every export added here is a promise to
 * consumers.
 */
export { NeatToastHost } from './lib/toast-host';
export type { NeatProgressToast } from './lib/toasts';
export { NeatToasts } from './lib/toasts';
