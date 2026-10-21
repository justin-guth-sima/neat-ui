import { NeatIconName } from '../icon/icon-registry';

/** One page in the shell's rail. */
export interface NeatNavItem {
  /** Shown as the link's name, its tooltip and, while the page is active, the page title. */
  label: string;
  icon: NeatIconName;
  /** Absolute app path, for example `/media`; the item stays active on routes nested under it. */
  path: string;
}
