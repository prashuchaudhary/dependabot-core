/* DEPENDENCY FILE PARSER
 *
 * Inputs:
 *  - directory containing a package.json and a yarn.lock
 *
 * Outputs:
 *  - list of dependencies and their current versions
 *
 * Extract a list of the packages specified in the package.json, with their
 * currently installed versions (which are in the yarn.lock)
 */
const path = require("path");
const { Install } = require("@dependabot/yarn-lib/lib/cli/commands/install");
const Config = require("@dependabot/yarn-lib/lib/config").default;
const { NoopReporter } = require("@dependabot/yarn-lib/lib/reporters");
const Lockfile = require("@dependabot/yarn-lib/lib/lockfile").default;
const semver = require("semver");

class DependabotReporter extends NoopReporter {
  lang(key, ...args) {
    return key;
  }
}

function isNotResolution(request) {
  return request.hint !== "resolution";
}

function source_file(dep, directory) {
  if (dep.request.workspaceLoc) {
    return path.relative(directory, dep.request.workspaceLoc);
  } else {
    return "package.json";
  }
}

async function parse(directory) {
  const flags = { ignoreScripts: true, includeWorkspaceDeps: true };
  const reporter = new DependabotReporter();
  const lockfile = await Lockfile.fromDirectory(directory, reporter);

  const config = new Config(reporter);
  await config.init({ cwd: directory });

  const install = new Install(flags, config, reporter, lockfile);
  const { requests, patterns } = await install.fetchRequestFromCwd();
  const deps = requests
    .filter(isNotResolution)
    .map(request => ({
      request: request,
      resolved: lockfile.getLocked(request.pattern)
    }))
    .filter(dep => dep.resolved);

  return deps.map(dep => ({
    name: dep.resolved.name,
    resolved: dep.resolved.resolved,
    version: semver.clean(dep.resolved.version),
    source_file: source_file(dep, directory)
  }));
}

module.exports = { parse };
