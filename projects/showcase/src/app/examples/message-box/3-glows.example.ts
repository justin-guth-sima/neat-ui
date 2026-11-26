import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NEAT_MESSAGE_BOX_GLOWS,
  NeatMessageBox,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from '@sima/neat-ui/chat';

/** How long the example's pretend board spends on each activity, in ms. */
const PHASES: readonly (readonly [NeatMessageBoxActivity, number])[] = [
  ['idle', 800],
  ['waiting', 1200],
  ['streaming', 2000],
];

/** Each glow's name in words. */
const NAMES: Record<NeatMessageBoxGlow, string> = {
  comet: 'Comet',
  'steady-comet': 'Steady comet',
  ring: 'Glow ring',
  aurora: 'Aurora',
  sheen: 'Sheen',
  none: 'None',
};

/**
 * The glows (`NEAT_MESSAGE_BOX_GLOWS`) while a pretend board works through a question again
 * and again: each moves while the board reads the question and, but the steady comet, faster while
 * the reply arrives, and goes once it is done. Under reduced motion each shows its colors still.
 *
 * @animated lossy
 */
@Component({
  selector: 'app-glows',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-glows.example.html',
  styleUrl: './glows.example.css',
})
export class Glows {
  protected readonly glows = NEAT_MESSAGE_BOX_GLOWS.map((glow) => ({ glow, name: NAMES[glow] }));
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');

  constructor() {
    let phase = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      this.activity.set(PHASES[phase][0]);
      timer = setTimeout(next, PHASES[phase][1]);
      phase = (phase + 1) % PHASES.length;
    };
    next();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
