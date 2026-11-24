import type {
  ExecutionEngine,
  ExecutionOptions,
  ExecutionResult,
  LanguageId,
  ProblemSpec,
} from '../types/schema';
import { executeCobol } from './cobolRunner';
import { executeJs } from './jsRunner';
import { executeRust } from './rustRunner';

export {
  detectCobolFormat,
  fixedToFreeCobol,
  freeToFixedCobol,
} from './cobolFormat';
export { executeCobol } from './cobolRunner';
export { executeJs } from './jsRunner';
export { executeRust } from './rustRunner';

export function createExecutionEngine(): ExecutionEngine {
  return {
    async execute(
      language: LanguageId,
      userCode: string,
      problemSpec: ProblemSpec,
      options?: ExecutionOptions
    ): Promise<ExecutionResult> {
      switch (language) {
        case 'js':
          return executeJs(userCode, problemSpec, options);
        case 'rust':
          return executeRust(userCode, problemSpec, options);
        case 'cobol':
          return executeCobol(userCode, problemSpec, options);
        default: {
          const exhaustiveCheck: never = language;
          throw new Error(`Unsupported language: ${String(exhaustiveCheck)}`);
        }
      }
    },
  };
}

export const executionEngine: ExecutionEngine = createExecutionEngine();
