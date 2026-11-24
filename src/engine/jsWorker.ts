import type { ProblemSpec } from '../types/schema';
import { evaluateJsDirect } from './jsEvalCore';

export interface JsWorkerRequest {
  userCode: string;
  problemSpec: ProblemSpec;
  timeoutMs: number;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<JsWorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

workerScope.onmessage = (event: MessageEvent<JsWorkerRequest>) => {
  const { userCode, problemSpec, timeoutMs } = event.data;
  const result = evaluateJsDirect(
    userCode,
    problemSpec,
    'web-worker',
    timeoutMs
  );
  workerScope.postMessage(result);
};
