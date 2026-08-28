/**
 * The individual preflight gates.
 *
 * Every gate is a plain async function returning
 *   { name, status: 'pass'|'fail'|'warn'|'skip', lines: string[] }
 * so the orchestrator can print them uniformly and decide the exit code.
 *
 * Gates read the BUILT SITE in dist/ wherever they can, rather than the source.
 * What ships is the build output, and a check that passes against source while
 * the output disagrees is worse than no check.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, extname, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const pass = (name, ...lines) => ({ name, status: 'pass', lines });
const fail = (name, ...lines) => ({ name, status: 'fail', lines });
const warn = (name, ...lines) => ({ name, status: 'warn', lines });
const skip = (name, ...lines) => ({ name, status: 'skip', lines });

/** Every file under a directory, recursively, as absolute paths. */
export function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const htmlFiles = (dist) => walk(dist).filter((f) => f.endsWith('.html'));

function run(cmd, args, cwd) {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000,
    });
    return { ok: true, out };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ''}${error.stderr ?? ''}` || String(error.message),
    };
  }
}

/* ------------------------------------------------------------------ */

export async function buildGate(root) {
  const res = run('npm', ['run', 'build'], root);
  if (!res.ok) {
    return fail('Build', 'npm run build failed:', ...res.out.trim().split('\n').slice(-12));
  }
  const pages = res.out.match(/(\d+) page\(s\) built/);
  return pass('Build', `clean — ${pages ? pages[1] : '?'} pages`);
}

export async function typesGate(root) {
  const res = run('npx', ['astro', 'check'], root);
  const errors = res.out.match(/(\d+) errors?/);
  if (errors && errors[1] !== '0') {
    return fail('Types', `astro check reports ${errors[1]} error(s)`,
      ...res.out.trim().split('\n').slice(-15));
  }
  if (!errors) return warn('Types', 'could not parse astro check output');
  const warns = res.out.match(/(\d+) warnings?/);
  return pass('Types', `0 errors, ${warns ? warns[1] : '?'} warnings`);
}

/**
 * Internal links must resolve to a real file in dist, and #fragments must
 * resolve to a real id on the target page.
 *
 * The Stage 4 exit criterion is that no URL which worked before launch breaks
 * after it. That starts with the site not linking to its own missing pages.
 */
export async function linksGate(root, dist) {
  const files = htmlFiles(dist);
  if (files.length === 0) return fail('Links', 'no HTML in dist — run the build first');

  // Map every servable URL path to the file that answers it.
  const served = new Map();
  for (const file of files) {
    const rel = '/' + relative(dist, file).split(/[\\/]/).join('/');
    served.set(rel, file);
    if (rel.endsWith('/index.html')) {
      const dir = rel.slice(0, -'index.html'.length); // "/circles/"
      served.set(dir, file);
      served.set(dir.replace(/\/$/, '') || '/', file); // "/circles"
    }
  }
  for (const asset of walk(dist).filter((f) => !f.endsWith('.html'))) {
    served.set('/' + relative(dist, asset).split(/[\\/]/).join('/'), asset);
  }

  const ids = new Map(); // file -> Set of ids
  const idsFor = (file) => {
    if (!ids.has(file)) {
      const html = readFileSync(file, 'utf8');
      ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    }
    return ids.get(file);
  };

  const broken = [];
  const brokenAnchors = [];
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const from = '/' + relative(dist, file).split(/[\\/]/).join('/');
    for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
      const href = m[1];
      // External, mail, tel, and protocol-relative links are out of scope —
      // this gate is about the site not breaking its own links.
      if (/^([a-z]+:)?\/\//i.test(href) || /^(mailto|tel|data):/i.test(href)) continue;
      if (href.startsWith('#')) {
        if (href !== '#' && !idsFor(file).has(href.slice(1))) {
          brokenAnchors.push(`${from} -> ${href}`);
        }
        continue;
      }
      const [rawPath, frag] = href.split('#');
      const path = rawPath.split('?')[0];
      if (!path) continue;
      const abs = path.startsWith('/')
        ? path
        : '/' + relative(dist, resolve(dirname(file), path)).split(/[\\/]/).join('/');
      const target = served.get(abs) ?? served.get(abs.replace(/\/$/, '')) ?? served.get(abs + '/');
      if (!target) {
        broken.push(`${from} -> ${href}`);
        continue;
      }
      if (frag && target.endsWith('.html') && !idsFor(target).has(frag)) {
        brokenAnchors.push(`${from} -> ${href}`);
      }
    }
  }

  const problems = [];
  if (broken.length) problems.push(`${broken.length} dead internal link(s):`, ...broken.slice(0, 12).map((b) => '  ' + b));
  if (brokenAnchors.length) problems.push(`${brokenAnchors.length} dead anchor(s):`, ...brokenAnchors.slice(0, 12).map((b) => '  ' + b));
  return problems.length
    ? fail('Links', ...problems)
    : pass('Links', `${files.length} pages, every internal link and anchor resolves`);
}

/**
 * Project invariants that would be expensive to get wrong in public:
 * the price list, the no-Stripe rule, and the cohort states.
 *
 * The allowed prices are read out of src/consts.ts rather than hard-coded, so
 * this gate cannot drift away from the single source of truth it is guarding.
 */
export async function contentGate(root, dist) {
  const lines = [];
  let bad = false;

  // --- prices ---
  const constsPath = join(root, 'src/consts.ts');
  if (!existsSync(constsPath)) {
    lines.push('src/consts.ts not found — skipping the price check');
  } else {
    const consts = readFileSync(constsPath, 'utf8');
    // Money only: "$150," in prose must not capture its trailing comma, and
    // "$1,200" must stay one price rather than two.
    const MONEY = /\$\d+(?:,\d{3})*(?:\.\d{2})?/g;
    const allowed = new Set(
      [...consts.matchAll(/label:\s*'(\$[^']+)'/g)]
        .flatMap((m) => m[1].match(MONEY) ?? []),
    );
    if (allowed.size === 0) {
      lines.push('no price labels found in consts.ts — price check inconclusive');
    } else {
      const found = new Set();
      for (const file of htmlFiles(dist)) {
        for (const m of readFileSync(file, 'utf8').matchAll(MONEY)) found.add(m[0]);
      }
      const stray = [...found].filter((p) => !allowed.has(p));
      if (stray.length) {
        bad = true;
        lines.push(`price(s) on the site that are not in consts.ts: ${stray.join(', ')}`);
        lines.push(`  allowed: ${[...allowed].join(', ')}`);
      } else {
        lines.push(`prices ok — only ${[...found].sort().join(', ')} appear anywhere`);
      }
    }
  }

  // --- no Stripe ---
  // Checked against the build output: a comment in source explaining why there
  // is no Stripe is fine, shipped Stripe code is not.
  const stripeHits = [];
  for (const file of walk(dist)) {
    if (!/\.(html|js|css)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (/js\.stripe\.com|pk_live_|pk_test_|Stripe\(/.test(text)) {
      stripeHits.push(relative(dist, file));
    }
  }
  if (stripeHits.length) {
    bad = true;
    lines.push(`Stripe code in the build output: ${stripeHits.join(', ')}`);
  } else {
    lines.push('no Stripe in the build output');
  }

  // --- cohort states ---
  const circlesDir = join(root, 'src/content/circles');
  if (existsSync(circlesDir)) {
    const cohorts = readdirSync(circlesDir).filter((f) => f.endsWith('.md'));
    let checked = 0;
    for (const file of cohorts) {
      const src = readFileSync(join(circlesDir, file), 'utf8');
      const status = src.match(/^status:\s*(\S+)/m)?.[1];
      const podia = src.match(/^podiaUrl:\s*(\S+)/m)?.[1];
      const slug = file.replace(/\.md$/, '');
      const page = join(dist, 'circles', slug, 'index.html');
      if (!existsSync(page)) {
        bad = true;
        lines.push(`cohort ${slug} (${status}) has no page in dist`);
        continue;
      }
      const html = readFileSync(page, 'utf8');
      checked++;
      if (status === 'completed') {
        // A finished cohort must never read as purchasable.
        if (/Join this Circle/.test(html)) {
          bad = true;
          lines.push(`completed cohort ${slug} offers "Join this Circle"`);
        }
        if (/\$\d/.test(html)) {
          bad = true;
          lines.push(`completed cohort ${slug} shows a price`);
        }
        if (!/view your archive/i.test(html)) {
          bad = true;
          lines.push(`completed cohort ${slug} has no archive link`);
        }
      }
      if (podia && !html.includes(podia)) {
        bad = true;
        lines.push(`cohort ${slug} does not link its podiaUrl`);
      }
      if (status !== 'completed' && status !== 'waitlist' && !podia) {
        bad = true;
        lines.push(`joinable cohort ${slug} has no podiaUrl`);
      }
    }
    lines.push(`${checked} cohort page(s) match their frontmatter state`);
  }

  return bad ? { name: 'Content', status: 'fail', lines } : pass('Content', ...lines);
}

/**
 * Cloudflare Pages specifics. These are the things that fail at deploy time or,
 * worse, silently at request time — long after the build looked fine.
 */
export async function cloudflareGate(root, dist) {
  const lines = [];
  let bad = false;

  if (!existsSync(dist)) return fail('Cloudflare', `output directory ${dist} does not exist`);

  const files = walk(dist);
  lines.push(`${files.length} files in the output directory`);

  // Pages rejects a deployment over these limits, and the error arrives late.
  const TOO_MANY = 20000;
  const TOO_BIG = 25 * 1024 * 1024;
  if (files.length > TOO_MANY) {
    bad = true;
    lines.push(`over the ${TOO_MANY}-file limit for a Pages deployment`);
  }
  const oversized = files.filter((f) => statSync(f).size > TOO_BIG);
  if (oversized.length) {
    bad = true;
    for (const f of oversized) {
      lines.push(`${relative(dist, f)} is ${(statSync(f).size / 1048576).toFixed(1)} MiB — the per-file limit is 25 MiB`);
    }
  }

  // _headers and _redirects are read from the output, not the repo root. Astro
  // copies public/ verbatim, so they belong in public/ — a common way to lose
  // them is to put them at the project root, where nothing picks them up.
  for (const name of ['_headers', '_redirects']) {
    const inDist = existsSync(join(dist, name));
    const inPublic = existsSync(join(root, 'public', name));
    const atRoot = existsSync(join(root, name));
    if (inDist) {
      lines.push(`${name} present in the output`);
    } else if (atRoot && !inPublic) {
      bad = true;
      lines.push(`${name} is at the project root, where Cloudflare will never see it — move it to public/`);
    } else {
      lines.push(`${name} absent (fine unless you need it)`);
    }
  }

  // Malformed lines are ignored silently at request time, so parse them here.
  const redirects = join(dist, '_redirects');
  if (existsSync(redirects)) {
    const rules = readFileSync(redirects, 'utf8')
      .split('\n')
      .map((l, i) => [i + 1, l.trim()])
      .filter(([, l]) => l && !l.startsWith('#'));
    for (const [n, rule] of rules) {
      const parts = rule.split(/\s+/);
      if (parts.length < 2 || parts.length > 3) {
        bad = true;
        lines.push(`_redirects line ${n} is not "<from> <to> [status]": ${rule}`);
      } else if (parts[2] && !/^(30[1278]|200|404)$/.test(parts[2])) {
        bad = true;
        lines.push(`_redirects line ${n} has an unsupported status: ${parts[2]}`);
      }
    }
    if (rules.length > 2000) {
      bad = true;
      lines.push(`${rules.length} redirect rules — the static limit is 2,000`);
    }
    lines.push(`${rules.length} redirect rule(s)`);
  }

  // A functions/ directory turns a static Pages project into one with a
  // runtime. Worth flagging because it changes the deploy and the billing.
  if (existsSync(join(root, 'functions'))) {
    lines.push('a functions/ directory exists — this deploys as Pages Functions, not a purely static site');
  }

  // Node version pinning: Cloudflare defaults to an old Node unless told.
  const nodeVersion = existsSync(join(root, '.node-version'))
    ? readFileSync(join(root, '.node-version'), 'utf8').trim()
    : null;
  if (nodeVersion) lines.push(`.node-version pins Node ${nodeVersion}`);
  else lines.push('no .node-version — Cloudflare picks its default, which may be older than the build needs');

  const wrangler = join(root, 'wrangler.toml');
  if (existsSync(wrangler)) {
    const toml = readFileSync(wrangler, 'utf8');
    const outDir = toml.match(/pages_build_output_dir\s*=\s*"([^"]+)"/)?.[1];
    if (!outDir) {
      lines.push('wrangler.toml has no pages_build_output_dir');
    } else if (relative(root, dist) !== outDir.replace(/^\.\//, '')) {
      bad = true;
      lines.push(`wrangler.toml points at "${outDir}" but the build wrote to "${relative(root, dist)}"`);
    } else {
      lines.push(`wrangler.toml output dir matches (${outDir})`);
    }
  } else {
    lines.push('no wrangler.toml — fine if the project is configured in the dashboard');
  }

  return bad ? { name: 'Cloudflare', status: 'fail', lines } : pass('Cloudflare', ...lines);
}

/**
 * Everything still waiting on a person. Informational for a preview deploy,
 * blocking for a launch — see the --launch flag.
 */
export async function placeholderGate(root, dist, { launch }) {
  const lines = [];
  const blockers = [];

  const srcFiles = walk(join(root, 'src')).filter((f) => /\.(astro|ts|md|css)$/.test(f));
  const todos = [];
  for (const file of srcFiles) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/TODO\(client\)/.test(line)) {
        todos.push(`${relative(root, file)}:${i + 1} ${line.trim().replace(/^[\s*/]+/, '').slice(0, 90)}`);
      }
    });
  }
  lines.push(`${todos.length} TODO(client) item(s)`);
  lines.push(...todos.map((t) => '  ' + t));

  // Provisional copy that is marked on the page itself.
  const provisional = htmlFiles(dist).filter((f) =>
    /Provisional wording/i.test(readFileSync(f, 'utf8')),
  );
  if (provisional.length) {
    lines.push(`${provisional.length} page(s) carry visible provisional copy:`);
    lines.push(...provisional.map((f) => '  /' + relative(dist, f).replace(/index\.html$/, '')));
    if (launch) blockers.push('provisional copy is still published');
  }

  // Forms that go nowhere.
  const consts = existsSync(join(root, 'src/consts.ts'))
    ? readFileSync(join(root, 'src/consts.ts'), 'utf8')
    : '';
  const endpointUnset = /endpoint:\s*null/.test(consts);
  const hasForms = htmlFiles(dist).some((f) => /<form/.test(readFileSync(f, 'utf8')));
  if (hasForms && endpointUnset) {
    lines.push('forms are published but FORMS.endpoint is null — submissions are not delivered anywhere');
    if (launch) blockers.push('forms have no handler');
  }

  // The redirect map, which is the whole point of the launch stage.
  const redirects = join(dist, '_redirects');
  const ruleCount = existsSync(redirects)
    ? readFileSync(redirects, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length
    : 0;
  if (launch && ruleCount === 0) {
    blockers.push('_redirects has no rules — every Podia URL in circulation must be inventoried first');
  }
  lines.push(`_redirects carries ${ruleCount} rule(s)`);

  if (blockers.length) {
    return { name: 'Launch readiness', status: 'fail', lines: [...blockers.map((b) => 'BLOCKER: ' + b), '', ...lines] };
  }
  return launch
    ? pass('Launch readiness', ...lines)
    : warn('Outstanding items', ...lines);
}

/** Contrast and accessibility both need a browser; they degrade to skip. */
export async function browserGate(root, name, script) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts?.[script]) return skip(name, `no "${script}" script in package.json`);
  const res = run('npm', ['run', script], root);
  if (res.ok) {
    const last = res.out.trim().split('\n').filter(Boolean).slice(-1)[0];
    return pass(name, last?.trim() ?? 'passed');
  }
  if (/playwright|browserType|Executable doesn't exist/i.test(res.out)) {
    return skip(name, 'Playwright or its browser is unavailable here — run this before shipping');
  }
  return fail(name, ...res.out.trim().split('\n').slice(-14));
}

/**
 * Boot the real Cloudflare runtime and assert against it.
 *
 * This is the gate that earns its keep. `npm run build` proves the bundler was
 * happy; it proves nothing about what Cloudflare will actually serve. The
 * _headers file in particular cannot be validated by reading it, because Pages
 * APPENDS the headers of every matching rule rather than letting a specific
 * rule override a broad one — so a Cache-Control under `/*` silently lands on
 * the hashed assets too and yields a concatenated, ambiguous header. That bug
 * shipped a build that was green in every other respect, and only showed up
 * under `wrangler pages dev`. Hence this gate.
 *
 * Skipped when wrangler is unavailable rather than failing, so the rest of the
 * preflight still runs in a bare environment.
 */
export async function runtimeGate(root, dist) {
  const { spawn } = await import('node:child_process');
  const PORT = Number(process.env.PREFLIGHT_PORT ?? 8789);
  const base = `http://127.0.0.1:${PORT}`;

  if (!existsSync(join(root, 'node_modules/wrangler'))) {
    return skip('Cloudflare runtime', 'wrangler is not installed — `npm i -D wrangler` to enable this gate');
  }

  const child = spawn('npx', ['wrangler', 'pages', 'dev', relative(root, dist), '--port', String(PORT), '--ip', '127.0.0.1'],
    { cwd: root, stdio: 'ignore', detached: true });

  const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} };

  try {
    let up = false;
    for (let i = 0; i < 30 && !up; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) });
        up = res.ok;
      } catch {}
    }
    if (!up) { stop(); return fail('Cloudflare runtime', 'wrangler pages dev did not come up within 30s'); }

    const lines = [];
    let bad = false;
    const note = (ok, msg) => { if (!ok) bad = true; lines.push((ok ? 'ok   ' : 'FAIL ') + msg); };

    // Hashed assets must carry exactly one immutable directive. A second
    // max-age appended from a broader rule is the failure this gate exists for.
    const asset = walk(dist).find((f) => /_astro\/.+\.(woff2|webp|css|js)$/.test(f));
    if (asset) {
      const url = '/' + relative(dist, asset).split(/[\\/]/).join('/');
      const cc = (await fetch(base + url)).headers.get('cache-control') ?? '';
      note(/immutable/.test(cc), `hashed asset is immutable (${cc || 'no Cache-Control'})`);
      note((cc.match(/max-age/g) ?? []).length <= 1,
        `hashed asset has a single Cache-Control directive — more than one means a broader _headers rule is appending to it`);
    }

    // Security headers should reach every response.
    const headers = (await fetch(base + '/')).headers;
    for (const h of ['x-content-type-options', 'referrer-policy']) {
      note(Boolean(headers.get(h)), `${h} present on HTML`);
    }

    // A missing page must return 404, not 200 with a soft error page.
    const missing = await fetch(base + '/definitely-not-a-real-page-xyz');
    note(missing.status === 404, `unknown path returns 404 (got ${missing.status})`);

    // Astro emits directory-style output, so Cloudflare 308s the unslashed
    // form. Worth asserting because the launch redirect map depends on it.
    const noSlash = await fetch(base + '/circles', { redirect: 'manual' });
    note([200, 301, 308].includes(noSlash.status),
      `unslashed path resolves (got ${noSlash.status})`);

    // Every built page must actually be served.
    let served = 0;
    const pages = htmlFiles(dist).filter((f) => !/404\.html$/.test(f));
    for (const file of pages) {
      const url = '/' + relative(dist, file).split(/[\\/]/).join('/').replace(/index\.html$/, '');
      if ((await fetch(base + url)).ok) served++;
    }
    note(served === pages.length, `${served}/${pages.length} pages served by the runtime`);

    stop();
    return bad
      ? { name: 'Cloudflare runtime', status: 'fail', lines }
      : pass('Cloudflare runtime', ...lines);
  } catch (error) {
    stop();
    return fail('Cloudflare runtime', error.message);
  }
}
