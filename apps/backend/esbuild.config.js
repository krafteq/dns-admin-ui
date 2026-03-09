import esbuild from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  // Native addons and Node.js built-ins cannot be bundled
  external: ['better-sqlite3'],
  // Preserve import.meta.url for __dirname usage
  banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
};

await esbuild.build({
  ...shared,
  entryPoints: ['src/index.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
});

console.log('Backend bundled successfully.');
