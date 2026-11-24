import type { SectionSpec } from '../../types/schema';
import { warmup1Section } from './warmup-1';
import { warmup2Section } from './warmup-2';
import { logic1Section } from './logic-1';
import { logic2Section } from './logic-2';
import { ownershipBorrowing1Section } from './ownership-borrowing-1';
import { optionResult1Section } from './option-result-1';
import { string1Section } from './string-1';
import { string2Section } from './string-2';
import { string3Section } from './string-3';
import { vecSlice1Section } from './vec-slice-1';
import { vecSlice2Section } from './vec-slice-2';
import { vecSlice3Section } from './vec-slice-3';
import { hashmap1Section } from './hashmap-1';
import { hashmap2Section } from './hashmap-2';
import { functional1Section } from './functional-1';
import { functional2Section } from './functional-2';
import { applied1Section } from './applied-1';
import { recursion1Section } from './recursion-1';
import { recursion2Section } from './recursion-2';

export const rustSections: SectionSpec[] = [
  warmup1Section,
  warmup2Section,
  logic1Section,
  logic2Section,
  ownershipBorrowing1Section,
  optionResult1Section,
  string1Section,
  string2Section,
  string3Section,
  vecSlice1Section,
  vecSlice2Section,
  vecSlice3Section,
  hashmap1Section,
  hashmap2Section,
  functional1Section,
  functional2Section,
  applied1Section,
  recursion1Section,
  recursion2Section,
];
