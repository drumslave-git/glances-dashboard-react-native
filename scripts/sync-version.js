// Propagates `package.json`'s version into the other files that carry one.
//
// `package.json` is the single source of truth — the Release workflow watches
// that field and nothing else. But the Expo manifest and the Tauri bundle each
// keep their own copy, and an installer stamped with a stale version is a
// support problem nobody enjoys. `npm version` runs this through its `version`
// lifecycle hook, so a bump touches all three at once.
//
// Run with `--check` to assert they agree without writing (the CI gate).
//
// Edits are surgical string replacements rather than a JSON round-trip, so the
// files keep their hand-written formatting.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;

const semver = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!semver) {
  console.error(`package.json version "${version}" is not X.Y.Z — refusing to sync.`);
  process.exit(1);
}
const [, major, minor, patch] = semver.map(Number);

/**
 * Android refuses to install an APK over one with an equal or higher
 * versionCode, so it has to climb with every release. Packing the semver into
 * one integer keeps it monotonic without a counter to remember, and leaves room
 * for 99 patches and 99 minors per major.
 */
const versionCode = major * 10000 + minor * 100 + patch;

const versionEdit = (label) => ({
  label,
  pattern: /("version"\s*:\s*")[^"]*"/,
  replacement: `$1${version}"`,
});

const targets = [
  {
    file: 'app.json',
    edits: [
      versionEdit('expo.version'),
      {
        label: 'expo.android.versionCode',
        pattern: /("versionCode"\s*:\s*)\d+/,
        replacement: `$1${versionCode}`,
      },
    ],
  },
  {
    file: path.join('src-tauri', 'tauri.conf.json'),
    edits: [versionEdit('version')],
  },
];

const check = process.argv.includes('--check');
const problems = [];
let written = 0;

for (const target of targets) {
  const file = path.join(root, target.file);
  const before = fs.readFileSync(file, 'utf8');
  let after = before;

  for (const edit of target.edits) {
    if (!edit.pattern.test(after)) {
      problems.push(`${target.file}: no ${edit.label} field to sync — has the file changed shape?`);
      continue;
    }
    after = after.replace(edit.pattern, edit.replacement);
  }

  if (after === before) continue;

  if (check) {
    problems.push(`${target.file} is out of sync with package.json (${version}).`);
  } else {
    fs.writeFileSync(file, after);
    console.log(`${target.file} -> ${version}`);
    written += 1;
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  if (check) console.error('\nRun `npm run sync:version` and commit the result.');
  process.exit(1);
}

if (check) {
  console.log(`Version ${version} (Android versionCode ${versionCode}) is consistent across all targets.`);
} else if (written === 0) {
  console.log(`Version ${version} already consistent across all targets.`);
}
