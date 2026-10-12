/**
 * dsh-skill-literature-download — a packaged host skill provider.
 *
 * The skill body lives at `skills/literature-download-automation/SKILL.md`
 * inside this package. This module mounts that directory as a skill root so
 * every agent in the deployment sees the skill without the user copying files
 * into `~/.dsh/skills` by hand.
 *
 * Why a dedicated provider row rather than reusing the preset's
 * `skill-filesystem`: on the Web surface the base host `skill-filesystem` row is
 * disabled and each agent preset mounts its own. A plugin cannot write into a
 * preset's layer, so it contributes to the deployment-global layer instead — the
 * layer the composition documents as carrying "whatever the deployment
 * registered globally (repository plugins)". The registry merges both layers
 * into the catalog an agent reads.
 *
 * This module therefore does not re-implement discovery. It delegates to
 * `@deepseek-ai/dsh-skill-filesystem`, which already owns root resolution,
 * frontmatter parsing, name validation, and rank assignment, and points that
 * provider's single bundled root at this package's own `skills/` directory.
 * Reusing the first-party provider keeps the skill's parsing and invocation
 * semantics identical to a hand-installed skill.
 *
 * The root is resolved from `import.meta.url`, not a relative path, so it is
 * correct regardless of the profile that loaded the plugin or the process cwd.
 *
 * @module dsh-skill-literature-download
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { apply as applyFileSystemSkills } from '@deepseek-ai/dsh-skill-filesystem'

export const name = 'dsh-skill-literature-download'

/**
 * This row contributes skills, so it resolves after `ctx.skills` exists. The
 * delegated provider declares the same dependency; re-exporting it here is what
 * makes the loader order this row correctly.
 */
export const inject = ['skills']

/**
 * Absolute path to this package's bundled skill root.
 *
 * `import.meta.url` points at `lib/index.js`, so the package root is one level
 * up. Going through `src` rather than hard-coding `..` keeps the resolution in
 * one place and documents why it is two parents and not one.
 *
 * The filesystem provider scans direct children of the configured root, so this
 * is the directory *containing* skill bundles, not the skill itself.
 */
export const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')

/**
 * The provider name this row registers under.
 *
 * This must NOT be the provider default (`filesystem`). The base profile and
 * every agent preset mount their own `skill-filesystem` row, and the registry
 * rejects a duplicate name by failing the whole plugin tree at boot:
 *
 *     a skill provider named "filesystem" is already registered
 *
 * That failure only appears when the plugin loads inside a real composed
 * profile, so an isolated unit check cannot catch it. A package-specific name
 * keeps this row's registration independent of how many other filesystem
 * providers the deployment already has.
 */
export const providerName = 'literature-download-bundle'

/**
 * Mount the filesystem skill provider against this package's bundled directory.
 *
 * `includeDefaultRoots: false` keeps this row from re-scanning the project and
 * user roots the preset already covers, so the plugin adds exactly one root and
 * never double-registers a skill the user also installed by hand.
 *
 * `watch: false` is likewise deliberate: a published package's contents do not
 * change while the process runs, so a watcher would only hold handles for
 * events that cannot occur.
 *
 * @param ctx - the cordis context for this row.
 */
export function apply(ctx, _config = {}) {
  applyFileSystemSkills(ctx, {
    providerName,
    includeDefaultRoots: false,
    bundledSkillDir: skillRoot,
    watch: false,
  })
}
