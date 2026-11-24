declare module '@live-codes/cobol-wasm' {
  export type CobolWasmSourceFormat = 'free' | 'fixed';

  export interface CobolWasmCompilerOptions {
    baseUrl?: string | URL;
    clangBaseUrl?: string | URL;
    sourceFormat?: CobolWasmSourceFormat;
    compileArgs?: string[];
    cCompileArgs?: string[];
    args?: string[];
    fileName?: string;
    maxAssetBytes?: number;
  }

  export interface CobolWasmRunOptions {
    sourceFormat?: CobolWasmSourceFormat;
    compileArgs?: string[];
    cCompileArgs?: string[];
    args?: string[];
    fileName?: string;
  }

  export interface CobolWasmRunResult {
    stdout: string;
    stderr: string;
    output: string;
    errors: string[];
    diagnostics: string[];
    exitCode: number | null;
    compileMs: number;
    runMs: number | null;
  }

  export interface CobolWasmCompiler {
    readonly sourceFormat: CobolWasmSourceFormat;
    readonly sourceFormats: CobolWasmSourceFormat[];
    run(
      code: string,
      input?: string | Uint8Array,
      runOptions?: CobolWasmRunOptions
    ): Promise<CobolWasmRunResult>;
    dispose(): void;
  }

  export const SOURCE_FORMATS: readonly ['free', 'fixed'];
  export function createCompiler(
    options?: CobolWasmCompilerOptions
  ): Promise<CobolWasmCompiler>;
}
