import type { NeatDiagramBadge } from '@sima/neat-ui/diagram';

/*
 * The badges follow the kit's convention for where a part runs: HW (the hardware decoder) success,
 * EV74 highlight, MLA info, A65 neutral.
 */
export const HW: NeatDiagramBadge = { label: 'HW', tone: 'success' };
export const EV74: NeatDiagramBadge = { label: 'EV74', tone: 'highlight' };
export const MLA: NeatDiagramBadge = { label: 'MLA', tone: 'info' };
export const A65: NeatDiagramBadge = { label: 'A65', tone: 'neutral' };
