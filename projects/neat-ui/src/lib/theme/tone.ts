/**
 * What a status color says.
 *
 * It says nothing in particular (`neutral`), that it went well, to take note, that it failed, or
 * that it is for information. `highlight`, the brand purple, is a distinct state that is none of
 * these.
 *
 * A status chip's fill and a select-list row's tint both take it. So a row and its chip, given the
 * same tone, say the same.
 */
export type NeatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'highlight';
