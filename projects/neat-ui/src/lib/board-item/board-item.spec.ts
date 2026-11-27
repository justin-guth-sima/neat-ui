import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RailState } from '../shell/rail-item';
import type { NeatTone } from '../theme/tone';
import { NeatBoardItem, type NeatBoardConnection, type NeatBoardStatus } from './board-item';

@Component({
  imports: [NeatBoardItem],
  providers: [RailState],
  template: `
    <neat-board-item
      neatRailEnd
      [name]="name()"
      [address]="address()"
      [connection]="connection()"
      [reason]="reason()"
      [status]="status()"
      (activated)="activations.set(activations() + 1)"
    />
  `,
})
class Host {
  readonly rail = inject(RailState);
  readonly name = signal('DevKit');
  readonly address = signal<string | null>('192.168.1.20');
  readonly connection = signal<NeatBoardConnection>('connected');
  readonly reason = signal<string | null>(null);
  readonly status = signal<NeatBoardStatus | null>(null);
  readonly activations = signal(0);
}

const WORDS: [NeatBoardConnection, string, NeatTone][] = [
  ['loading', 'Loading…', 'neutral'],
  ['not-selected', 'Not selected', 'neutral'],
  ['not-checked', 'Not checked', 'neutral'],
  ['checking', 'Checking…', 'warning'],
  ['connecting', 'Connecting…', 'warning'],
  ['connected', 'Connected', 'success'],
  ['unreachable', 'Not reachable', 'danger'],
];

describe('NeatBoardItem', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const button = (): HTMLButtonElement => root.querySelector('button[neatRailItem]')!;
    const lines = (): string[] =>
      Array.from(button().querySelectorAll('.line'), (line) => line.textContent!.trim());
    const region = (): HTMLElement => root.querySelector('[role="status"]')!;
    const set = async (change: (host: Host) => void): Promise<void> => {
      change(fixture.componentInstance);
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, button, lines, region, set };
  }

  it('renders one rail item button with the board icon, which opens a dialog', async () => {
    const { button, fixture } = await render();

    expect(fixture.nativeElement.querySelectorAll('button[neatRailItem]').length).toBe(1);
    expect(button().getAttribute('aria-haspopup')).toBe('dialog');
    expect(button().getAttribute('type')).toBe('button');
    expect(button().querySelector('neat-icon')?.getAttribute('name')).toBe('board');
  });

  it.each(WORDS)('says %s as "%s" with the %s tone', async (connection, words, tone) => {
    const { button, lines, set } = await render();
    await set((host) => {
      host.connection.set(connection);
      host.address.set(null);
    });

    expect(lines()).toEqual(['DevKit', words]);
    expect(button().getAttribute('data-tone')).toBe(tone);
  });

  it('shows the address as the second line while connected, else the connection’s words', async () => {
    const { lines, set } = await render();

    expect(lines()).toEqual(['DevKit', '192.168.1.20']);

    await set((host) => host.connection.set('connecting'));
    expect(lines()).toEqual(['DevKit', 'Connecting…']);

    await set((host) => {
      host.connection.set('connected');
      host.address.set(null);
    });
    expect(lines()).toEqual(['DevKit', 'Connected']);
  });

  it('lets the app’s status outrank the connection in the second line and the dot', async () => {
    const { button, lines, set } = await render();
    await set((host) => host.status.set({ text: 'Loading models', tone: 'warning' }));

    expect(lines()).toEqual(['DevKit', 'Loading models']);
    expect(button().getAttribute('data-tone')).toBe('warning');

    await set((host) => host.status.set(null));
    expect(lines()).toEqual(['DevKit', '192.168.1.20']);
    expect(button().getAttribute('data-tone')).toBe('success');
  });

  it('names the item and its tooltip: name, address, connection, status', async () => {
    const { button, set } = await render();
    // The label is the name the item takes from its content.
    const name = (): string => button().textContent!.replace(/\s+/g, ' ').trim();

    expect(name()).toContain('DevKit, 192.168.1.20, Connected');

    await set((host) => host.status.set({ text: 'Loading models', tone: 'warning' }));
    expect(name()).toContain('DevKit, 192.168.1.20, Connected, Loading models');

    await set((host) => {
      host.connection.set('unreachable');
      host.reason.set('Timed out');
      host.status.set(null);
      host.address.set(null);
    });
    expect(name()).toContain('DevKit, Not reachable: Timed out');
  });

  it('announces the label politely when it changes, and not on the first render', async () => {
    const { region, set } = await render();

    expect(region().getAttribute('aria-live') ?? 'polite').toBe('polite');
    expect(region().classList).toContain('sr-only');
    expect(region().textContent?.trim()).toBe('');

    await set((host) => host.connection.set('unreachable'));
    expect(region().textContent?.trim()).toBe('DevKit, 192.168.1.20, Not reachable');
  });

  it('announces nothing when an input changes to an equal value', async () => {
    const { region, set } = await render();
    await set((host) => host.connection.set('checking'));
    const said = region().textContent;
    const nodes = region().childNodes[0];

    await set((host) => {
      host.connection.set('checking');
      host.status.set(null);
      host.address.set('192.168.1.20');
      host.name.set('DevKit');
    });

    expect(region().textContent).toBe(said);
    expect(region().childNodes[0]).toBe(nodes);
  });

  it('tells the app when it is pressed', async () => {
    const { button, host, fixture } = await render();

    button().click();
    await fixture.whenStable();

    expect(host.activations()).toBe(1);
  });

  it('lands in the rail’s end slot as a component, with its button as the one tab stop', async () => {
    const { fixture } = await render();
    const element: HTMLElement = fixture.nativeElement.querySelector('neat-board-item');

    expect(element.hasAttribute('neatRailEnd')).toBe(true);
    expect(element.querySelectorAll('button, a, [tabindex]').length).toBe(1);
  });
});
