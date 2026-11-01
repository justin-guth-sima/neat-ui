import type { NeatDiagramChip } from '@sima/neat-ui/diagram';

/*
 * The chips follow the kit's convention for where a part runs: HW (the hardware decoder) success,
 * EV74 highlight, MLA info, A65 neutral.
 */
export const HW: NeatDiagramChip = { label: 'HW', tone: 'success' };
export const EV74: NeatDiagramChip = { label: 'EV74', tone: 'highlight' };
export const MLA: NeatDiagramChip = { label: 'MLA', tone: 'info' };
export const A65: NeatDiagramChip = { label: 'A65', tone: 'neutral' };
