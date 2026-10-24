/**
 * What a status colour says: nothing in particular (`neutral`), it went well, take note, it
 * failed, for information, or a distinct state that is none of these (`highlight`, the brand
 * purple). A status chip's fill and a select-list row's tint both take it, so that a row and its
 * chip, given the same tone, say the same.
 */
export type NeatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'highlight';
