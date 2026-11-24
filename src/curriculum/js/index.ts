import type { SectionSpec } from '../../types/schema';
import { warmup1Section } from './warmup1';
import { warmup2Section } from './warmup2';
import { logic1Section } from './logic1';
import { logic2Section } from './logic2';
import { string1Section } from './string1';
import { string2Section } from './string2';
import { string3Section } from './string3';
import { array1Section } from './array1';
import { array2Section } from './array2';
import { array3Section } from './array3';
import { map1Section } from './map1';
import { map2Section } from './map2';
import { functional1Section } from './functional1';
import { functional2Section } from './functional2';
import { applied1Section } from './applied1';
import { recursion1Section } from './recursion1';
import { recursion2Section } from './recursion2';

export const jsSections: SectionSpec[] = [
  warmup1Section,
  warmup2Section,
  logic1Section,
  logic2Section,
  string1Section,
  string2Section,
  string3Section,
  array1Section,
  array2Section,
  array3Section,
  map1Section,
  map2Section,
  functional1Section,
  functional2Section,
  applied1Section,
  recursion1Section,
  recursion2Section,
];
