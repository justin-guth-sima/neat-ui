import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

const APP_CONFIG = `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNeatTitles, provideNeatUi } from '@sima/neat-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNeatUi(), provideNeatTitles('Streams')],
};
`;

/**
 * A whole file, its lines and indents as written. With `overflow="scroll"` a long line keeps its
 * shape, and the block scrolls sideways.
 *
 * Make the window narrow and scroll the code.
 */
@Component({
  selector: 'app-whole-file',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-whole-file.example.html',
})
export class WholeFile {
  protected readonly file = APP_CONFIG;
}
