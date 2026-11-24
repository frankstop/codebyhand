import type { SectionSpec } from '../../types/schema';
import { warmup1Section } from './warmup-1';
import { warmup2Section } from './warmup-2';
import { logic1Section } from './logic-1';
import { logic2Section } from './logic-2';
import { picFixedPoint1Section } from './pic-fixed-point-1';
import { picEditedOutput2Section } from './pic-edited-output-2';
import { string1Section } from './string-1';
import { stringInspect2Section } from './string-inspect-2';
import { performLoops1Section } from './perform-loops-1';
import { tablesOccurs1Section } from './tables-occurs-1';
import { tablesOccurs2Section } from './tables-occurs-2';
import { lookupKeyValue1Section } from './lookup-key-value-1';
import { recordBusinessLogic1Section } from './record-business-logic-1';

export const cobolSections: SectionSpec[] = [
  warmup1Section,
  warmup2Section,
  logic1Section,
  logic2Section,
  picFixedPoint1Section,
  picEditedOutput2Section,
  string1Section,
  stringInspect2Section,
  performLoops1Section,
  tablesOccurs1Section,
  tablesOccurs2Section,
  lookupKeyValue1Section,
  recordBusinessLogic1Section,
];
