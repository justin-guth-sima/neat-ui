import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatMarkdown } from '@sima/neat-ui/markdown';

/**
 * A model's reply in Markdown: a heading, a list, a table and code, drawn in the kit's prose, its
 * table look and its code block.
 */
@Component({
  selector: 'app-reply',
  imports: [NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-reply.example.html',
})
export class Reply {
  protected readonly reply = `## Pasta al pomodoro

What the shelf holds makes most of it:

- **dried pasta**, the long kind
- olive oil and a braid of *garlic*
- canned tomatoes

| Step | Minutes |
| --- | --: |
| Sauté the garlic | 2 |
| Simmer the tomatoes | 15 |
| Boil the pasta | 10 |

\`\`\`python
servings = 4
pasta_g = 100 * servings
\`\`\``;
}
