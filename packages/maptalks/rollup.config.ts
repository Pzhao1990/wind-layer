import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { RollupOptions, defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import esbuild from 'rollup-plugin-esbuild';
import json from '@rollup/plugin-json';
import glslify from 'rollup-plugin-glslify';
import replace from '@rollup/plugin-replace';
import alias from '@rollup/plugin-alias';
import dts from 'rollup-plugin-dts';
import { terser } from 'rollup-plugin-terser';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');
const ROOT = fileURLToPath(import.meta.url);
const DEV = process.env.NODE_ENV === 'development';
const MINIFY = process.env.MINIFY;
const PROD = !DEV;

const r = (p: string) => resolve(ROOT, '..', p);

const umdExternal = [
  'maptalks',
];

const external = [
  ...umdExternal,
  ...Object.keys(pkg.dependencies),
];

const plugins = [
  alias({
    entries: [
      { find: '@', replacement: r('./src') },
    ],
  }),
  replace({
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    preventAssignment: true,
  }),
  glslify(),
  commonjs(),
  nodeResolve({ preferBuiltins: false }),
  esbuild({ target: 'node14' }),
  json({
    namedExports: true,
  }),
];

const esmBuild: RollupOptions = {
  input: r('src/index.ts'),
  output: {
    format: 'esm',
    file: pkg.module,
    sourcemap: true,
  },
  external,
  plugins,
  onwarn(warning, warn) {
    if (warning.code !== 'EVAL') warn(warning);
  },
};

const cjsBuild: RollupOptions = {
  input: r('src/index.ts'),
  output: {
    format: 'cjs',
    file: pkg.commonjs,
    sourcemap: true,
  },
  external,
  plugins,
  onwarn(warning, warn) {
    if (warning.code !== 'EVAL') warn(warning);
  },
}

const umdBuild: RollupOptions = {
  input: r('src/index.ts'),
  output: {
    format: 'umd',
    dir: undefined,
    name: pkg.namespace,
    sourcemap: !MINIFY,
    file: MINIFY ? pkg.main.split('.').splice(pkg.main.split('.').length - 1, 0, 'min').join('.') : pkg.main,
    globals: {
      maptalks: 'maptalks',
    },
    outro: `
      var __warnings = {};

      function __warnOnce(msg) {
        if (!__warnings[msg]) {
          console.warn('[maptalks-wind]: ', msg);
          __warnings[msg] = true;
        }
      }
      var G = typeof window === "undefined" ? global : window;

if (G && G.mtkWind) {
  window.MaptalksWind = window.mtkWind;
  __warnOnce('MaptalksWind namespace will deprecated please use mtkWind instead！');
}
    `
  },
  external: umdExternal,
  plugins: [
    ...plugins,
    ...(MINIFY ? [
      terser(),
    ] : []),
  ],
  onwarn(warning, warn) {
    if (warning.code !== 'EVAL') warn(warning);
  },
};

const typesBuild: RollupOptions = {
  input: r('src/index.ts'),
  output: {
    format: 'esm',
    file: pkg.types,
  },
  external,
  plugins: [
    dts({ respectExternal: true }),
  ],
};

const config = defineConfig([]);

config.push(esmBuild);
config.push(umdBuild);

if (PROD) {
  config.push(cjsBuild);
}

config.push(typesBuild);

export default config;
