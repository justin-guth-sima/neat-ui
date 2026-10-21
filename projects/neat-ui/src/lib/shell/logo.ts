import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The SiMa.ai icon mark in full colour, from the brand folder ("Icon Only", Digital, Small; the
 * stylesheet classes inlined as `fill` attributes). Its fills are the brand asset itself, not
 * theme styling, so they stay literal here. Internal to the shell.
 */
@Component({
  selector: 'neat-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      role="img"
      aria-label="SiMa.ai"
      viewBox="0 0 111.34 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#a4cc2d" d="M86.08,83.06,100,69.23V100S94.4,92.45,86.08,83.06Z" />
      <path
        fill="#d1cee6"
        d="M53.94,53.87,100,69.23,86.08,83.06C77.28,73.12,65.44,61.14,53.94,53.87Z"
      />
      <path
        fill="#5998dd"
        d="M53.94,53.87c11.5,7.27,23.34,19.25,32.14,29.19L69.18,99.85A77,77,0,0,0,53.94,53.87Z"
      />
      <path fill="#010f0e" d="M69.18,99.85l16.9-16.79C94.4,92.45,100,100,100,100H69.23Z" />
      <polygon fill="#2a9c4f" points="100 0 100 30.77 84.62 15.39 100 0" />
      <polygon fill="#010f0e" points="100 30.77 69.24 30.77 84.62 15.39 100 30.77" />
      <polygon fill="#a4cc2d" points="84.62 15.39 69.24 30.77 69.24 0 84.62 15.39" />
      <polygon fill="#c0e8db" points="30.77 69.23 15.39 84.62 0 69.23 30.77 69.23" />
      <polygon fill="#d26728" points="30.77 69.23 30.77 100 15.39 84.62 30.77 69.23" />
      <polygon fill="#010f0e" points="30.77 100 0 100 15.39 84.62 30.77 100" />
      <polygon fill="#2a9c4f" points="15.39 84.62 0 100 0 69.23 15.39 84.62" />
      <path fill="#d26728" d="M13.92,16.94,0,30.77V0S5.6,7.55,13.92,16.94Z" />
      <path
        fill="#010f0e"
        d="M46.06,46.13,0,30.77,13.92,16.94C22.72,26.88,34.56,38.86,46.06,46.13Z"
      />
      <path
        fill="#5998dd"
        d="M46.06,46.13c-11.5-7.27-23.34-19.25-32.14-29.19L30.82.15A77,77,0,0,0,46.06,46.13Z"
      />
      <polygon fill="#c0e8db" points="100 0 84.62 15.39 69.24 0 100 0" />
      <path fill="#d1cee6" d="M30.82.15,13.92,16.94C5.6,7.55,0,0,0,0H30.77Z" />
      <path
        fill="#010f0e"
        d="M103.34,0h3.28V.67h-1.27V4h-.74V.67h-1.27Zm8,0V4h-.76V1.34L109.72,4h-.79l-.85-2.69V4h-.76V0h1l1,3.27,1-3.27Z"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    svg {
      height: 1.75rem;
      width: auto;
    }
  `,
})
export class NeatLogo {}
