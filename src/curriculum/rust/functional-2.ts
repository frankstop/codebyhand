import type { SectionSpec, TestCase } from '../../types/schema';

function tc(
  call: string,
  expectedDisplay: string,
  rustCallExpr: string,
  rustExpectedExpr: string,
  hidden = false
): TestCase {
  return hidden
    ? { call, expectedDisplay, rustCallExpr, rustExpectedExpr, hidden: true }
    : { call, expectedDisplay, rustCallExpr, rustExpectedExpr };
}

function rsVecStr(items: string[]): string {
  if (items.length === 0) {
    return 'Vec::<String>::new()';
  }
  return `vec![${items.map((s) => `${JSON.stringify(s)}.to_string()`).join(', ')}]`;
}

function dispVecStr(items: string[]): string {
  return `[${items.map((s) => JSON.stringify(s)).join(', ')}]`;
}

export const functional2Section: SectionSpec = {
  id: 'functional-2',
  language: 'rust',
  title: 'Functional-2',
  description:
    'Chained Rust iterator pipelines combining `.filter(...)`, `.map(...)`, `.fold(...)`, and `.collect()`.',
  difficultyRange: [250, 349],
  problems: [
    {
      id: 'rust-functional-2-no-neg',
      slug: 'no_neg',
      language: 'rust',
      sectionId: 'functional-2',
      title: 'no_neg',
      difficulty: 255,
      doc: 'Given a slice of `i32` integers `nums`, return a `Vec<i32>` of the integers omitting any that are less than `0`.',
      functionName: 'no_neg',
      starterCode: `pub fn no_neg(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `nums.iter().copied().filter(|&x| x >= 0).collect()`.',
          snippet: 'nums.iter().copied().filter(|&x| x >= 0).collect()',
        },
        {
          text: 'Note that `0` is NOT negative (`0 >= 0`), so `0` should be kept.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn no_neg(nums: &[i32]) -> Vec<i32> {\n    nums.iter().copied().filter(|&x| x >= 0).collect()\n}`,
      tests: [
        tc('no_neg(&[1, -2])', '[1]', 'no_neg(&[1, -2])', 'vec![1]'),
        tc('no_neg(&[-3, -3, 3, 3])', '[3, 3]', 'no_neg(&[-3, -3, 3, 3])', 'vec![3, 3]'),
        tc('no_neg(&[-1, -1, -1])', '[]', 'no_neg(&[-1, -1, -1])', 'Vec::<i32>::new()'),
        tc('no_neg(&[])', '[]', 'no_neg(&[])', 'Vec::<i32>::new()'),
        tc('no_neg(&[0, 1, 2])', '[0, 1, 2]', 'no_neg(&[0, 1, 2])', 'vec![0, 1, 2]'),
        tc('no_neg(&[3, -10, 1, -1, 4, -400])', '[3, 1, 4]', 'no_neg(&[3, -10, 1, -1, 4, -400])', 'vec![3, 1, 4]', true),
        tc('no_neg(&[-1, 3, 1, -1, -10, -100, -111, 5])', '[3, 1, 5]', 'no_neg(&[-1, 3, 1, -1, -10, -100, -111, 5])', 'vec![3, 1, 5]', true),
        tc('no_neg(&[0])', '[0]', 'no_neg(&[0])', 'vec![0]', true),
        tc('no_neg(&[-5])', '[]', 'no_neg(&[-5])', 'Vec::<i32>::new()', true),
        tc('no_neg(&[100, -1, 200])', '[100, 200]', 'no_neg(&[100, -1, 200])', 'vec![100, 200]', true),
        tc('no_neg(&[-10, 0, -20])', '[0]', 'no_neg(&[-10, 0, -20])', 'vec![0]', true),
        tc('no_neg(&[7, 8, 9])', '[7, 8, 9]', 'no_neg(&[7, 8, 9])', 'vec![7, 8, 9]', true),
      ],
    },
    {
      id: 'rust-functional-2-no9',
      slug: 'no9',
      language: 'rust',
      sectionId: 'functional-2',
      title: 'no9',
      difficulty: 270,
      doc: 'Given a slice of non-negative `i32` integers `nums`, return a `Vec<i32>` of those numbers omitting any that end with `9` (`x % 10 == 9`).',
      functionName: 'no9',
      starterCode: `pub fn no9(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Filter with `|&x| x % 10 != 9`.',
          snippet: 'nums.iter().copied().filter(|&x| x % 10 != 9).collect()',
        },
        {
          text: 'Notice `90` ends in `0` (`90 % 10 == 0`) so `90` stays, while `9`, `19`, `29` are removed.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn no9(nums: &[i32]) -> Vec<i32> {\n    nums.iter().copied().filter(|&x| x % 10 != 9).collect()\n}`,
      tests: [
        tc('no9(&[1, 2, 19])', '[1, 2]', 'no9(&[1, 2, 19])', 'vec![1, 2]'),
        tc('no9(&[9, 19, 29, 3])', '[3]', 'no9(&[9, 19, 29, 3])', 'vec![3]'),
        tc('no9(&[1, 2, 3])', '[1, 2, 3]', 'no9(&[1, 2, 3])', 'vec![1, 2, 3]'),
        tc('no9(&[45, 99, 90, 28, 13, 999, 0])', '[45, 90, 28, 13, 0]', 'no9(&[45, 99, 90, 28, 13, 999, 0])', 'vec![45, 90, 28, 13, 0]'),
        tc('no9(&[])', '[]', 'no9(&[])', 'Vec::<i32>::new()'),
        tc('no9(&[9])', '[]', 'no9(&[9])', 'Vec::<i32>::new()', true),
        tc('no9(&[0, 9, 0])', '[0, 0]', 'no9(&[0, 9, 0])', 'vec![0, 0]', true),
        tc('no9(&[90, 91, 99])', '[90, 91]', 'no9(&[90, 91, 99])', 'vec![90, 91]', true),
        tc('no9(&[109, 209, 300])', '[300]', 'no9(&[109, 209, 300])', 'vec![300]', true),
        tc('no9(&[8, 18, 28])', '[8, 18, 28]', 'no9(&[8, 18, 28])', 'vec![8, 18, 28]', true),
        tc('no9(&[19, 29])', '[]', 'no9(&[19, 29])', 'Vec::<i32>::new()', true),
        tc('no9(&[10])', '[10]', 'no9(&[10])', 'vec![10]', true),
      ],
    },
    {
      id: 'rust-functional-2-no-teen',
      slug: 'no_teen',
      language: 'rust',
      sectionId: 'functional-2',
      title: 'no_teen',
      difficulty: 285,
      doc: 'Given a slice of `i32` integers `nums`, return a `Vec<i32>` of those numbers omitting any that are between `13` and `19` inclusive.',
      functionName: 'no_teen',
      starterCode: `pub fn no_teen(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `!(13..=19).contains(&x)` inside `.filter(...)`.',
          snippet: 'nums.iter().copied().filter(|x| !(13..=19).contains(x)).collect()',
        },
        {
          text: 'Both `12` and `20` remain, while `13` through `19` are filtered out.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn no_teen(nums: &[i32]) -> Vec<i32> {\n    nums.iter()\n        .copied()\n        .filter(|x| !(13..=19).contains(x))\n        .collect()\n}`,
      tests: [
        tc('no_teen(&[12, 13, 19, 20])', '[12, 20]', 'no_teen(&[12, 13, 19, 20])', 'vec![12, 20]'),
        tc('no_teen(&[1, 14, 1])', '[1, 1]', 'no_teen(&[1, 14, 1])', 'vec![1, 1]'),
        tc('no_teen(&[15])', '[]', 'no_teen(&[15])', 'Vec::<i32>::new()'),
        tc('no_teen(&[-15])', '[-15]', 'no_teen(&[-15])', 'vec![-15]'),
        tc('no_teen(&[])', '[]', 'no_teen(&[])', 'Vec::<i32>::new()'),
        tc('no_teen(&[0, 1, 2, -3])', '[0, 1, 2, -3]', 'no_teen(&[0, 1, 2, -3])', 'vec![0, 1, 2, -3]', true),
        tc('no_teen(&[15, 17, 19, 21, 19])', '[21]', 'no_teen(&[15, 17, 19, 21, 19])', 'vec![21]', true),
        tc('no_teen(&[-16, 2, 15, 3, 16, 25])', '[-16, 2, 3, 25]', 'no_teen(&[-16, 2, 15, 3, 16, 25])', 'vec![-16, 2, 3, 25]', true),
        tc('no_teen(&[13, 14, 15, 16, 17, 18, 19])', '[]', 'no_teen(&[13, 14, 15, 16, 17, 18, 19])', 'Vec::<i32>::new()', true),
        tc('no_teen(&[12, 20])', '[12, 20]', 'no_teen(&[12, 20])', 'vec![12, 20]', true),
        tc('no_teen(&[-13, -19])', '[-13, -19]', 'no_teen(&[-13, -19])', 'vec![-13, -19]', true),
        tc('no_teen(&[100, 18, 200])', '[100, 200]', 'no_teen(&[100, 18, 200])', 'vec![100, 200]', true),
      ],
    },
    {
      id: 'rust-functional-2-no-z',
      slug: 'no_z',
      language: 'rust',
      sectionId: 'functional-2',
      title: 'no_z',
      difficulty: 300,
      doc: 'Given a slice of string slices `strings`, return a `Vec<String>` of those strings omitting any string that contains a lowercase `\'z\'`.',
      functionName: 'no_z',
      starterCode: `pub fn no_z(strings: &[&str]) -> Vec<String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Filter with `.filter(|&&s| !s.contains(\'z\'))`, then `.map(|&s| s.to_string()).collect()`.',
          snippet: 'strings.iter().filter(|&&s| !s.contains(\'z\')).map(|&s| s.to_string()).collect()',
        },
        {
          text: 'Filtering BEFORE `.to_string()` avoids allocating `String`s for discarded elements!',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn no_z(strings: &[&str]) -> Vec<String> {\n    strings\n        .iter()\n        .filter(|&&s| !s.contains('z'))\n        .map(|&s| s.to_string())\n        .collect()\n}`,
      tests: [
        tc('no_z(&["aaa", "bbb", "aza"])', dispVecStr(['aaa', 'bbb']), 'no_z(&["aaa", "bbb", "aza"])', rsVecStr(['aaa', 'bbb'])),
        tc('no_z(&["hziz", "hzello", "hi"])', dispVecStr(['hi']), 'no_z(&["hziz", "hzello", "hi"])', rsVecStr(['hi'])),
        tc('no_z(&["hello", "howz", "are", "youz"])', dispVecStr(['hello', 'are']), 'no_z(&["hello", "howz", "are", "youz"])', rsVecStr(['hello', 'are'])),
        tc('no_z(&[])', '[]', 'no_z(&[])', rsVecStr([])),
        tc('no_z(&[""])', dispVecStr(['']), 'no_z(&[""])', rsVecStr([''])),
        tc('no_z(&["x", "y", "z"])', dispVecStr(['x', 'y']), 'no_z(&["x", "y", "z"])', rsVecStr(['x', 'y']), true),
        tc('no_z(&["Z", "z"])', dispVecStr(['Z']), 'no_z(&["Z", "z"])', rsVecStr(['Z']), true),
        tc('no_z(&["zzz", "zz"])', '[]', 'no_z(&["zzz", "zz"])', rsVecStr([]), true),
        tc('no_z(&["rust", "zero", "borrow"])', dispVecStr(['rust', 'borrow']), 'no_z(&["rust", "zero", "borrow"])', rsVecStr(['rust', 'borrow']), true),
        tc('no_z(&["buzz", "fizz"])', '[]', 'no_z(&["buzz", "fizz"])', rsVecStr([]), true),
        tc('no_z(&["ok"])', dispVecStr(['ok']), 'no_z(&["ok"])', rsVecStr(['ok']), true),
        tc('no_z(&["a", "zb", "c"])', dispVecStr(['a', 'c']), 'no_z(&["a", "zb", "c"])', rsVecStr(['a', 'c']), true),
      ],
    },
    {
      id: 'rust-functional-2-two2',
      slug: 'two2',
      language: 'rust',
      sectionId: 'functional-2',
      title: 'two2',
      difficulty: 320,
      doc: 'Given a slice of non-negative `i32` integers `nums`, return a `Vec<i32>` of those numbers multiplied by `2`, omitting any of the resulting numbers that end in `2` (`val % 10 == 2`).',
      functionName: 'two2',
      starterCode: `pub fn two2(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Chain `.map(|&x| x * 2)` FIRST, then `.filter(|&y| y % 10 != 2)`, then `.collect()`!',
          snippet: 'nums.iter().map(|&x| x * 2).filter(|&y| y % 10 != 2).collect()',
        },
        {
          text: 'Notice `1` doubles to `2` (omitted) and `6` doubles to `12` (omitted), while `2` doubles to `4` (kept!).',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn two2(nums: &[i32]) -> Vec<i32> {\n    nums.iter()\n        .map(|&x| x * 2)\n        .filter(|&y| y % 10 != 2)\n        .collect()\n}`,
      tests: [
        tc('two2(&[1, 2, 3])', '[4, 6]', 'two2(&[1, 2, 3])', 'vec![4, 6]'),
        tc('two2(&[2, 6, 11])', '[4]', 'two2(&[2, 6, 11])', 'vec![4]'),
        tc('two2(&[0])', '[0]', 'two2(&[0])', 'vec![0]'),
        tc('two2(&[])', '[]', 'two2(&[])', 'Vec::<i32>::new()'),
        tc('two2(&[1, 11, 111, 16])', '[]', 'two2(&[1, 11, 111, 16])', 'Vec::<i32>::new()'),
        tc('two2(&[2, 3, 5, 7, 11])', '[4, 6, 10, 14]', 'two2(&[2, 3, 5, 7, 11])', 'vec![4, 6, 10, 14]', true),
        tc('two2(&[3, 1, 4, 1, 6, 99, 0])', '[6, 8, 198, 0]', 'two2(&[3, 1, 4, 1, 6, 99, 0])', 'vec![6, 8, 198, 0]', true),
        tc('two2(&[6])', '[]', 'two2(&[6])', 'Vec::<i32>::new()', true),
        tc('two2(&[5, 10, 15])', '[10, 20, 30]', 'two2(&[5, 10, 15])', 'vec![10, 20, 30]', true),
        tc('two2(&[21, 26])', '[]', 'two2(&[21, 26])', 'Vec::<i32>::new()', true),
        tc('two2(&[4, 8])', '[8, 16]', 'two2(&[4, 8])', 'vec![8, 16]', true),
        tc('two2(&[50, 51, 52])', '[100, 104]', 'two2(&[50, 51, 52])', 'vec![100, 104]', true),
      ],
    },
    {
      id: 'rust-functional-2-sum-squares-of-evens',
      slug: 'sum_squares_of_evens',
      language: 'rust',
      sectionId: 'functional-2',
      title: 'sum_squares_of_evens',
      difficulty: 340,
      doc: 'Given a slice of `i32` integers `nums`, keep only the even numbers (`x % 2 == 0`), square each one (`x * x`), and fold them into their total `i32` sum (`0` if there are no even numbers).',
      note: 'Combine `.iter()`, `.filter(...)`, `.map(...)`, and `.fold(0, |acc, v| acc + v)` into a zero-allocation iterator pipeline!',
      functionName: 'sum_squares_of_evens',
      starterCode: `pub fn sum_squares_of_evens(nums: &[i32]) -> i32 {\n    todo!()\n}`,
      hints: [
        {
          text: 'Filter even numbers with `.filter(|&&x| x % 2 == 0)` and square with `.map(|&x| x * x)`.',
          snippet: 'nums.iter()\n    .filter(|&&x| x % 2 == 0)\n    .map(|&x| x * x)\n    .fold(0, |acc, v| acc + v)',
        },
        {
          text: '`.fold(0, |acc, v| acc + v)` (or `.sum()`) reduces the lazy iterator in O(1) memory.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn sum_squares_of_evens(nums: &[i32]) -> i32 {\n    nums.iter()\n        .filter(|&&x| x % 2 == 0)\n        .map(|&x| x * x)\n        .fold(0, |acc, v| acc + v)\n}`,
      tests: [
        tc('sum_squares_of_evens(&[1, 2, 3, 4])', '20', 'sum_squares_of_evens(&[1, 2, 3, 4])', '20'),
        tc('sum_squares_of_evens(&[1, 3, 5])', '0', 'sum_squares_of_evens(&[1, 3, 5])', '0'),
        tc('sum_squares_of_evens(&[])', '0', 'sum_squares_of_evens(&[])', '0'),
        tc('sum_squares_of_evens(&[-2, -4, 3])', '20', 'sum_squares_of_evens(&[-2, -4, 3])', '20'),
        tc('sum_squares_of_evens(&[2, 4, 6])', '56', 'sum_squares_of_evens(&[2, 4, 6])', '56'),
        tc('sum_squares_of_evens(&[0, 10])', '100', 'sum_squares_of_evens(&[0, 10])', '100', true),
        tc('sum_squares_of_evens(&[8])', '64', 'sum_squares_of_evens(&[8])', '64', true),
        tc('sum_squares_of_evens(&[7])', '0', 'sum_squares_of_evens(&[7])', '0', true),
        tc('sum_squares_of_evens(&[-6, 0, 6])', '72', 'sum_squares_of_evens(&[-6, 0, 6])', '72', true),
        tc('sum_squares_of_evens(&[2, 2, 2, 2])', '16', 'sum_squares_of_evens(&[2, 2, 2, 2])', '16', true),
        tc('sum_squares_of_evens(&[1, 2, 3, 4, 5, 6, 7, 8])', '120', 'sum_squares_of_evens(&[1, 2, 3, 4, 5, 6, 7, 8])', '120', true),
        tc('sum_squares_of_evens(&[-1, -3, -5])', '0', 'sum_squares_of_evens(&[-1, -3, -5])', '0', true),
      ],
    },
  ],
};
