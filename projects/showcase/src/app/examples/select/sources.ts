import type { NeatSelectOption } from '@sima/neat-ui/select';

/** The choices of the select examples; one is disabled, so the keys skip it. */
export const SOURCES: NeatSelectOption<string>[] = [
  { value: 'camera', label: 'Front camera' },
  { value: 'clip', label: 'Warehouse clip' },
  { value: 'rtsp', label: 'RTSP stream' },
  { value: 'usb', label: 'USB camera (unavailable)', disabled: true },
  { value: 'file', label: 'Loading dock recording' },
];
