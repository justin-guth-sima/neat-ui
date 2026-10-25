import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { neatAsideOpen } from './aside-open';
import { NeatViewport } from './viewport';

describe('neatAsideOpen', () => {
  const narrow = signal(false);
  const remembered = signal(false);
  const remember = vi.fn();

  const create = () => TestBed.runInInjectionContext(() => neatAsideOpen(remembered, remember));

  beforeEach(() => {
    narrow.set(false);
    remembered.set(false);
    remember.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: NeatViewport, useValue: { narrow } }],
    });
  });

  it('wide: open follows remembered and set remembers', () => {
    const aside = create();
    expect(aside.open()).toBe(false);

    remembered.set(true);
    expect(aside.open()).toBe(true);

    aside.set(false);
    expect(remember).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('narrow: starts closed whatever was remembered', () => {
    remembered.set(true);
    narrow.set(true);

    expect(create().open()).toBe(false);
  });

  it('narrow: set opens and closes without remembering', () => {
    narrow.set(true);
    const aside = create();

    aside.set(true);
    expect(aside.open()).toBe(true);
    aside.set(false);
    expect(aside.open()).toBe(false);

    expect(remember).not.toHaveBeenCalled();
  });

  it('going wide shows the remembered choice again', () => {
    narrow.set(true);
    const aside = create();
    aside.set(true);
    expect(aside.open()).toBe(true);

    narrow.set(false);

    expect(aside.open()).toBe(false);
    remembered.set(true);
    expect(aside.open()).toBe(true);
  });

  it('going narrow again starts closed', () => {
    narrow.set(true);
    const aside = create();
    aside.set(true);
    expect(aside.open()).toBe(true);
    narrow.set(false);
    expect(aside.open()).toBe(false);

    narrow.set(true);

    expect(aside.open()).toBe(false);
  });

  it('going narrow with the panel open closes it', () => {
    remembered.set(true);
    const aside = create();
    expect(aside.open()).toBe(true);

    narrow.set(true);

    expect(aside.open()).toBe(false);
    expect(remember).not.toHaveBeenCalled();
  });
});
