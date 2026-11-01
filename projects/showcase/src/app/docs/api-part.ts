import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NeatCode, NeatNote } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { CodeBox } from './code-box';
import {
  KIND_LABEL,
  memberLabel,
  type MemberGroup,
  memberValue,
  transformNote,
  typeParameters,
  usageLine,
} from './display';
import { DocText } from './doc-text';
import type { DocsDeclaredPart, DocsMember, DocsMethod } from './model';
import { TypeText } from './type-text';

/** The groups a member can be listed in; methods are written by their signature. */
type RowGroup = MemberGroup | 'methods';

/**
 * One member as a stacked row, since three columns do not fit the panel: its name as bound, its
 * type, whether it is required or where it starts, then its doc.
 */
@Component({
  selector: 'app-api-member',
  imports: [DocText, NeatCallout, NeatCode, NeatNote, NeatStatusChip, NgTemplateOutlet, TypeText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="line">
      <!-- Its text in an element of its own, so the template adds no space around it. -->
      <code neatCode class="name">
        @if (member().deprecated) {
          <s><ng-container *ngTemplateOutlet="name" /></s>
        } @else {
          <ng-container *ngTemplateOutlet="name" />
        }
      </code>
      <ng-template #name>
        @if (method(); as method) {
          <app-type-text [text]="method.signature" />
        } @else {
          <ng-container>{{ label() }}</ng-container>
        }
      </ng-template>
      @if (type(); as type) {
        <code neatCode class="type"><app-type-text [text]="type" /></code>
      }
      @if (transform(); as transform) {
        <span neatNote>{{ transform }}</span>
      }
      @if (accepts(); as accepts) {
        <span neatNote
          >accepts <code neatCode><app-type-text [text]="accepts" /></code
        ></span>
      }
      @if (value(); as value) {
        @switch (value.kind) {
          @case ('required') {
            <neat-status-chip class="value" tone="warning" variant="tinted"
              >required</neat-status-chip
            >
          }
          @case ('default') {
            <span class="value" neatNote
              >default <code neatCode>{{ value.value }}</code></span
            >
          }
          @default {
            <span class="value" neatNote>{{ value.kind }}</span>
          }
        }
      }
    </div>
    @if (member().deprecated; as deprecated) {
      <neat-callout tone="warning" heading="Deprecated">
        <app-doc-text [blocks]="deprecated" />
      </neat-callout>
    }
    @if (member().doc.length) {
      <app-doc-text [blocks]="member().doc" />
    }
  `,
  styleUrl: './api-member.css',
})
export class ApiMember {
  readonly member = input.required<DocsMember | DocsMethod>();
  readonly group = input.required<RowGroup>();

  protected readonly method = computed(() => {
    const member = this.member();
    return 'signature' in member ? member : null;
  });
  private readonly field = computed(() => {
    const member = this.member();
    return 'signature' in member ? null : member;
  });
  protected readonly label = computed(() => {
    const field = this.field();
    const group = this.group();
    return field && group !== 'methods' ? memberLabel(group, field) : '';
  });
  protected readonly type = computed(() => this.field()?.type ?? null);
  protected readonly transform = computed(() => {
    const field = this.field();
    return field ? transformNote(field) : null;
  });
  protected readonly accepts = computed(() => this.field()?.accepts ?? null);
  protected readonly value = computed(() => {
    const field = this.field();
    const group = this.group();
    return field && group !== 'methods' ? memberValue(group, field) : null;
  });
}

/** A titled group of member rows. */
interface Rows {
  readonly title: string;
  readonly group: RowGroup;
  readonly members: readonly (DocsMember | DocsMethod)[];
}

/** What a part's kind has beyond the head every part shares. */
interface PartView {
  readonly exportAs: string | null;
  readonly extends: string | null;
  /** A function's signature, a type's definition, a const's type: type text in a box. */
  readonly code: string | null;
  /** A template directive's variables. */
  readonly context: readonly DocsMember[];
  /** An interface's members, listed without a heading. */
  readonly members: readonly DocsMember[];
  readonly groups: readonly Rows[];
}

const NOTHING: PartView = {
  exportAs: null,
  extends: null,
  code: null,
  context: [],
  members: [],
  groups: [],
};

/** The groups that have members, in the order given. */
function rows(groups: readonly [string, RowGroup, Rows['members'] | undefined][]): Rows[] {
  return groups.flatMap(([title, group, members]) =>
    members?.length ? [{ title, group, members }] : [],
  );
}

/** An interface with more members than this starts with them folded, under their count. */
const FOLD_MEMBERS = 6;

/**
 * One part's section of the API panel, anchored `#api-<Name>`: the head every kind shares, then
 * what its kind has (a usage line, a signature, a definition, a template's variables), its doc
 * unless the body shows it, and its members by group.
 */
@Component({
  selector: 'app-api-part',
  imports: [
    ApiMember,
    CodeBox,
    DocText,
    NeatCallout,
    NeatCode,
    NeatCollapsible,
    NeatNote,
    NeatStatusChip,
    NgTemplateOutlet,
    TypeText,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[id]': "'api-' + part().name" },
  template: `
    <div class="head">
      <!-- Focused when a link reveals the part, so the keyboard carries on from here. -->
      <h3 tabindex="-1">
        <code>
          @if (part().deprecated) {
            <s>{{ part().name }}</s>
          } @else {
            <ng-container>{{ part().name }}</ng-container>
          }
          <ng-container>{{ typeParameters() }}</ng-container>
        </code>
      </h3>
      <neat-status-chip>{{ kind() }}</neat-status-chip>
    </div>
    @if (usage(); as usage) {
      <code neatCode class="showcase-muted" data-slot="usage">{{ usage }}</code>
    }
    @if (view().exportAs; as exportAs) {
      <code neatCode class="showcase-muted" data-slot="usage">#x="{{ exportAs }}"</code>
    }
    @if (view().extends; as extended) {
      <p neatNote>
        Extends <code neatCode><app-type-text [text]="extended" /></code>
      </p>
    }
    @for (also of part().alsoExportedFrom ?? []; track also.import) {
      <p neatNote>
        Also exported from <code neatCode>{{ also.import }}</code>
      </p>
      <app-doc-text [blocks]="also.note" />
    }
    @if (part().deprecated; as deprecated) {
      <neat-callout tone="warning" heading="Deprecated">
        <app-doc-text [blocks]="deprecated" />
      </neat-callout>
    }
    @if (view().code; as code) {
      <app-code-box [code]="code" linked />
    }
    @if (view().context.length) {
      <h4>Context</h4>
      @for (variable of view().context; track variable.name) {
        <app-api-member [member]="variable" group="context" />
      }
    }
    @if (!intro() && part().doc.length) {
      <app-doc-text [blocks]="part().doc" />
    }
    @if (view().members.length > foldMembers) {
      <neat-collapsible [label]="view().members.length + ' members'">
        <ng-container *ngTemplateOutlet="members" />
      </neat-collapsible>
    } @else {
      <ng-container *ngTemplateOutlet="members" />
    }
    <ng-template #members>
      @for (member of view().members; track member.name) {
        <app-api-member [member]="member" group="members" />
      }
    </ng-template>
    @for (rows of view().groups; track rows.group) {
      <h4>{{ rows.title }}</h4>
      @for (member of rows.members; track member.name) {
        <app-api-member [member]="member" [group]="rows.group" />
      }
    }
  `,
  styleUrl: './api-part.css',
})
export class ApiPart {
  readonly part = input.required<DocsDeclaredPart>();
  /** The body introduces the part, its doc included, so the panel leaves the doc out. */
  readonly intro = input(false);

  protected readonly foldMembers = FOLD_MEMBERS;
  protected readonly kind = computed(() => KIND_LABEL[this.part().kind]);
  protected readonly typeParameters = computed(() => typeParameters(this.part()));
  protected readonly usage = computed(() => usageLine(this.part()));

  /** What the part's kind has beyond the shared head, in one shape for the template. */
  protected readonly view = computed((): PartView => {
    const part = this.part();
    switch (part.kind) {
      case 'function':
        return { ...NOTHING, code: part.signature };
      case 'type':
        return { ...NOTHING, code: part.definition };
      case 'const':
        return { ...NOTHING, code: part.type };
      case 'interface':
        return {
          ...NOTHING,
          extends: part.extends?.join(', ') ?? null,
          members: part.members,
          groups: rows([['Methods', 'methods', part.methods]]),
        };
      default:
        return {
          ...NOTHING,
          exportAs: part.exportAs ?? null,
          extends: part.extends?.join(', ') ?? null,
          context: part.context ?? [],
          groups: rows([
            ['Inputs', 'inputs', part.inputs],
            ['Two-way', 'models', part.models],
            ['Outputs', 'outputs', part.outputs],
            ['Methods', 'methods', part.methods],
            ['Properties', 'properties', part.properties],
          ]),
        };
    }
  });
}
