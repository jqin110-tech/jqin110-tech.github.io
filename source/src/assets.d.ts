declare module '*.jpg' {
  const src: string;
  export default src;
}

/** true in the build that is served at jqin110-tech.github.io (see vite.config.ts). */
declare const __HOSTED__: boolean;
