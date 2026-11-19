import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

/**
 * A command to run, with a Copy button named "Copy install command". A long command wraps.
 *
 * Press Copy, then paste the command somewhere.
 */
@Component({
  selector: 'app-install-command',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-install-command.example.html',
})
export class InstallCommand {
  protected readonly command = 'npm install ./vendor/sima-neat-ui-<version>.tgz';
}
