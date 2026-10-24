# @sima/neat-ui

SiMa.ai-branded Angular UI kit for Neat applications. See the repository README and AGENTS.md for
development and usage guidance.

## Dependencies

`d3-scale` and `d3-shape` (and the d3 packages they depend on) are ISC licensed. Only the
`@sima/neat-ui/charts` entry point uses them, so an app that never imports it does not bundle them.
