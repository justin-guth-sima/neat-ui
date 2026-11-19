import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatPage } from '@sima/neat-ui';

/** The page's sections, each with the id its link names. */
const SECTIONS = [
  { id: 'install', title: 'Install' },
  { id: 'configure', title: 'Configure' },
  { id: 'run', title: 'Run' },
  { id: 'troubleshoot', title: 'Troubleshoot' },
];

/**
 * A page of sections and a list of links to them. `NeatPage` scrolls its body to the element a
 * URL's fragment names, so the links need nothing of their own.
 *
 * The contents are plain in-page links (`href="#run"`); the link under each section is a
 * `routerLink` with a `fragment`. Both keep the page's route and add a history entry, so Back
 * returns to where the reader was. Follow a link, then press Back.
 *
 * @page
 */
@Component({
  selector: 'app-links-to-sections',
  imports: [NeatPage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-links-to-sections.example.html',
})
export class LinksToSections {
  protected readonly sections = SECTIONS;
}
