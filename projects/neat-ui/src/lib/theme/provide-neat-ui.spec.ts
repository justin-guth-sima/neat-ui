import { EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNeatUi } from './provide-neat-ui';

describe('provideNeatUi', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('neat-dark');
  });

  it('applies the stored scheme at start-up without anyone injecting ThemeService', () => {
    localStorage.setItem('neat-ui:color-scheme', 'dark');
    TestBed.configureTestingModule({ providers: [provideNeatUi()] });

    TestBed.inject(EnvironmentInjector);

    expect(document.documentElement.classList.contains('neat-dark')).toBe(true);
  });
});
