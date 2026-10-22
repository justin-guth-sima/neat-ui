// Writes the kit's colour tokens (Spartan's CSS variables) to the committed tokens.generated.css,
// which the kit stylesheet compiles in. Run `npm run theme:emit` after changing anything in
// projects/neat-ui/src/lib/theme/; a spec fails while the file and the TypeScript disagree.
import { writeFileSync } from 'node:fs';
import { buildSpartanThemeCss } from '../projects/neat-ui/src/lib/theme/spartan-theme';
import { NEAT_DARK_CLASS } from '../projects/neat-ui/src/lib/theme/theme.service';

const OUTPUT = new URL('../projects/neat-ui/src/lib/theme/tokens.generated.css', import.meta.url);

writeFileSync(OUTPUT, buildSpartanThemeCss(NEAT_DARK_CLASS));
console.log(`Wrote ${OUTPUT.pathname}`);
