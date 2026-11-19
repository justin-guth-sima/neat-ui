import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, provideNeatCodeLanguages } from '@sima/neat-ui/code-block';

const CHANGE = `--- a/run_model.py
+++ b/run_model.py
@@ -21,5 +21,5 @@
 model = pyneat.Model(MODEL, build_options(224))
 image = np.full((224, 224, 3), 99, dtype=np.uint8)  # a gray test frame
 tensor = pyneat.Tensor.from_numpy(image, copy=True, image_format=pyneat.PixelFormat.RGB)
-outputs = model.run([tensor], timeout_ms=2000)
+outputs = model.run([tensor], timeout_ms=500)
 print(f"top1={int(np.argmax(outputs[0].to_numpy()))}")
`;

/**
 * A language the kit does not color by itself, a diff, added with `provideNeatCodeLanguages`. Its
 * grammar comes from Shiki's `@shikijs/langs` as a dynamic import, so it loads only when a block
 * shows a diff.
 *
 * Here the example's own `providers` add it for the blocks in its template. An app that shows diffs
 * on many pages adds it in its `app.config.ts` instead.
 */
@Component({
  selector: 'app-another-language',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNeatCodeLanguages({ diff: () => import('@shikijs/langs/diff') })],
  templateUrl: './5-another-language.example.html',
})
export class AnotherLanguage {
  protected readonly change = CHANGE;
}
