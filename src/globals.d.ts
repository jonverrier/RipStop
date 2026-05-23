// ===Start StrongAI Generated Comment (20260523)===
// This module is a TypeScript declaration shim for the external package named "picomatch". It describes the public shape of that package so TypeScript can type-check code that imports and calls it. The module’s purpose is to model a tiny API: a function that compiles a glob-like pattern string into a reusable matcher function.
// 
// The main export is the default CommonJS export, named picomatch. It takes a single string argument called pattern and returns a Matcher. A Matcher is a function type that accepts an input string and returns a boolean indicating whether the input matches the compiled pattern.
// 
// There are no classes and no additional helper exports. This file does not implement matching logic; it only provides types. It also has no local imports. The only key dependency is the runtime "picomatch" package itself, which must be installed and available at execution time for the matcher behavior.
// ===End StrongAI Generated Comment===

declare module 'picomatch' {
  type Matcher = (input: string) => boolean;
  function picomatch(pattern: string): Matcher;
  export = picomatch;
}
