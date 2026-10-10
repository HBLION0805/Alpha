// Invoked by the strict CMD entrypoint, not npm or tsx.
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

if (Number(process.versions.node.split('.')[0]) < 24 ||
    JSON.stringify(process.execArgv) !== JSON.stringify(['--permission','--allow-fs-read=*','--no-addons']) ||
    !process.permission || process.permission.has('fs.write') ||
    process.permission.has('child') || process.permission.has('worker') ||
    process.permission.has('addons') || process.env.NODE_DISABLE_COMPILE_CACHE !== '1' ||
    process.env.NODE_OPTIONS || process.env.NODE_COMPILE_CACHE || process.env.NODE_V8_COVERAGE) {
  throw Error('STRICT_READ_ONLY_LAUNCH_REQUIRED');
}
// The installed TypeScript compiler transforms in memory; no tsx/esbuild worker,
// child process, disk transform cache, output file, or source-map file is used.
const {default: ts} = await import('typescript');
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.{1,2}\//.test(specifier) || /\.[a-z]+$/i.test(specifier)) throw error;
      return nextResolve(specifier + '.ts', context);
    }
  },
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.ts')) return nextLoad(url, context);
    const result = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      fileName: fileURLToPath(url),
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        sourceMap: false, inlineSourceMap: false, declaration: false},
    });
    return {format: 'module', source: result.outputText, shortCircuit: true};
  },
});
try {
  const {mockResidualCli} = await import('./options-tech-mock-residual.mjs');
  const result = mockResidualCli(process.argv.slice(2));
  console.log(JSON.stringify({...result, launchReceipt: {
    entry: 'STRICT_NODE_READ_ONLY_V1', filesystemWritePermission: false,
    childProcessPermission: false, workerPermission: false, nativeAddonPermission: false,
    npmInvoked: false, tsxInvoked: false, compileCacheEnabled: false,
    transform: 'INSTALLED_TYPESCRIPT_IN_MEMORY', output: 'STDOUT_STDERR_ONLY',
  }}, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
