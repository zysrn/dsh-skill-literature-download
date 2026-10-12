/**
 * Integration test: does this plugin mount and actually serve the skill?
 *
 * Unit-testing `apply()` in isolation is not enough here. Two real failure
 * modes only appear once the plugin runs inside a composed application:
 *
 *   1. The row registers nothing, so the catalog stays empty. A config dump
 *      cannot detect this — the row is present either way.
 *   2. The provider name collides. The registry rejects a duplicate name by
 *      failing the whole plugin tree, and the default filesystem provider name
 *      is exactly what every stock profile already registers.
 *
 * Both are covered below.
 *
 * cordis mounts asynchronously: `ctx.plugin()` returns a fiber that settles on
 * a later task turn, so inspecting the registry immediately after mounting
 * observes an empty list. The test awaits a task turn before asserting.
 *
 * Run with: npm test
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')

const require = createRequire(join(packageRoot, 'package.json'))
const asUrl = (spec) => pathToFileURL(require.resolve(spec)).href

const { Context } = await import(asUrl('@deepseek-ai/cordis'))
const plugin = await import(pathToFileURL(join(packageRoot, 'lib/index.js')).href)
const { BUNDLED_SKILL_RANK } = await import(asUrl('@deepseek-ai/dsh-skill'))

const failures = []
const check = (ok, label, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

console.log(`plugin name   : ${plugin.name}`)
console.log(`provider name : ${plugin.providerName}`)
console.log(`skill root    : ${plugin.skillRoot}\n`)

check(Array.isArray(plugin.inject) && plugin.inject.includes('skills'),
  'plugin declares the skills dependency')
check(typeof plugin.apply === 'function', 'plugin exports apply()')
check(existsSync(plugin.skillRoot), 'bundled skill root exists', plugin.skillRoot)

// The collision guard: registering under the provider default would break every
// stock profile, so this is asserted rather than merely documented.
check(plugin.providerName !== 'filesystem',
  'provider name does not collide with the stock filesystem provider')

// A second mount must be rejected the same way the real registry rejects it, so
// the check above is not the only thing standing between a user and a boot
// failure.
const seen = []
const mounted = []
const app = new Context()
app.provide('skills', {
  registerProvider(factory) {
    const ctrl = { invalidate() {}, signal: new AbortController().signal }
    const instance = factory(ctrl)
    if (seen.includes(instance.name)) {
      throw new Error(`a skill provider named "${instance.name}" is already registered`)
    }
    seen.push(instance.name)
    mounted.push(instance)
    return () => {}
  },
})

app.plugin({ name: plugin.name, inject: plugin.inject, apply: plugin.apply })
await new Promise((resolve) => setTimeout(resolve, 100))

check(seen.length === 1, 'mounts exactly one provider', `got ${seen.length}`)

if (mounted.length !== 1) {
  console.error('\nFAIL: could not obtain the mounted provider')
  process.exit(1)
}

const liveProvider = mounted[0]
const catalog = await liveProvider.list({ cwd: packageRoot })

check(catalog.length === 1, 'catalog contains exactly one skill', `got ${catalog.length}`)

const skill = catalog.find((s) => s.name === 'literature-download-automation')
check(Boolean(skill), 'expected skill is in the catalog')

if (skill) {
  check(skill.source === 'bundled', 'skill reports the bundled source', skill.source)
  check(skill.invocation.modelInvocable === true, 'skill is model-invocable')
  check(skill.invocation.userInvocable === true, 'skill is user-invocable')
  check(skill.rank === BUNDLED_SKILL_RANK,
    'skill uses the documented bundled rank', String(skill.rank))
  check(existsSync(skill.resourceBase?.path ?? ''),
    'skill resource directory exists', skill.resourceBase?.path)

  // A summary with an unreadable body would advertise a skill the agent cannot
  // use, so the body is loaded and its content asserted, not just its presence.
  const body = await liveProvider.get(skill, { signal: new AbortController().signal })
  const text = body?.content
  check(typeof text === 'string' && text.includes('批量下载文献全文'),
    'skill body loads and matches its heading', `${text?.length ?? 0} chars`)
}

console.log()
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('all checks passed')
