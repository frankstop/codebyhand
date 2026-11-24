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

export const functional1Section: SectionSpec = {
  id: 'functional-1',
  language: 'rust',
  title: 'Functional-1',
  description:
    'Declarative iterator transformations using `.iter()`, `.map(|...| ...)`, and `.collect()` over numeric and string slices.',
  difficultyRange: [200, 299],
  problems: [
    {
      id: 'rust-functional-1-doubling',
      slug: 'doubling',
      language: 'rust',
      sectionId: 'functional-1',
      title: 'doubling',
      difficulty: 205,
      doc: 'Given a slice of `i32` integers `nums`, return a `Vec<i32>` where each integer is multiplied by `2`.',
      note: 'Chain `nums.iter().map(|&x| x * 2).collect()` — Rust infers the `Vec<i32>` target type from the function return signature!',
      functionName: 'doubling',
      starterCode: `pub fn doubling(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Call `nums.iter()` to iterate over `&i32`, `.map(|&x| x * 2)` to transform each value, and `.collect()` to materialize the `Vec<i32>`.',
          snippet: 'nums.iter().map(|&x| x * 2).collect()',
        },
        {
          text: 'Empty slices cleanly collect into an empty `Vec`.',
        },
      ],
      showsolution: true,
      showpost: true,
      solution: `pub fn doubling(nums: &[i32]) -> Vec<i32> {\n    nums.iter().map(|&x| x * 2).collect()\n}`,
      tests: [
        tc('doubling(&[1, 2, 3])', '[2, 4, 6]', 'doubling(&[1, 2, 3])', 'vec![2, 4, 6]'),
        tc('doubling(&[6, 8, 6, 8, -1])', '[12, 16, 12, 16, -2]', 'doubling(&[6, 8, 6, 8, -1])', 'vec![12, 16, 12, 16, -2]'),
        tc('doubling(&[])', '[]', 'doubling(&[])', 'Vec::<i32>::new()'),
        tc('doubling(&[5])', '[10]', 'doubling(&[5])', 'vec![10]'),
        tc('doubling(&[5, 10])', '[10, 20]', 'doubling(&[5, 10])', 'vec![10, 20]'),
        tc('doubling(&[8, -5, 7, 3, 109])', '[16, -10, 14, 6, 218]', 'doubling(&[8, -5, 7, 3, 109])', 'vec![16, -10, 14, 6, 218]', true),
        tc('doubling(&[6, -3, 12, 23, 4, 1, 19, 11, 2, 3, 2])', '[12, -6, 24, 46, 8, 2, 38, 22, 4, 6, 4]', 'doubling(&[6, -3, 12, 23, 4, 1, 19, 11, 2, 3, 2])', 'vec![12, -6, 24, 46, 8, 2, 38, 22, 4, 6, 4]', true),
        tc('doubling(&[3, 1, 4, 1, 5, 9])', '[6, 2, 8, 2, 10, 18]', 'doubling(&[3, 1, 4, 1, 5, 9])', 'vec![6, 2, 8, 2, 10, 18]', true),
        tc('doubling(&[0])', '[0]', 'doubling(&[0])', 'vec![0]', true),
        tc('doubling(&[-10, 0, 10])', '[-20, 0, 20]', 'doubling(&[-10, 0, 10])', 'vec![-20, 0, 20]', true),
        tc('doubling(&[100, -100])', '[200, -200]', 'doubling(&[100, -100])', 'vec![200, -200]', true),
        tc('doubling(&[7, 7, 7])', '[14, 14, 14]', 'doubling(&[7, 7, 7])', 'vec![14, 14, 14]', true),
      ],
    },
    {
      id: 'rust-functional-1-square',
      slug: 'square',
      language: 'rust',
      sectionId: 'functional-1',
      title: 'square',
      difficulty: 220,
      doc: 'Given a slice of `i32` integers `nums`, return a `Vec<i32>` where each integer is multiplied with itself (`x * x`).',
      functionName: 'square',
      starterCode: `pub fn square(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `nums.iter().map(|&x| x * x).collect()`.',
          snippet: 'nums.iter().map(|&x| x * x).collect()',
        },
        {
          text: 'Squaring negative numbers automatically produces non-negative results.',
        },
      ],
      showsolution: true,
      showpost: true,
      solution: `pub fn square(nums: &[i32]) -> Vec<i32> {\n    nums.iter().map(|&x| x * x).collect()\n}`,
      tests: [
        tc('square(&[1, 2, 3])', '[1, 4, 9]', 'square(&[1, 2, 3])', 'vec![1, 4, 9]'),
        tc('square(&[6, 8, -6, -8, 1])', '[36, 64, 36, 64, 1]', 'square(&[6, 8, -6, -8, 1])', 'vec![36, 64, 36, 64, 1]'),
        tc('square(&[])', '[]', 'square(&[])', 'Vec::<i32>::new()'),
        tc('square(&[12])', '[144]', 'square(&[12])', 'vec![144]'),
        tc('square(&[5, 10])', '[25, 100]', 'square(&[5, 10])', 'vec![25, 100]'),
        tc('square(&[6, -3, 12, 23, 4, 1, 19, 11, 2, 3, 2])', '[36, 9, 144, 529, 16, 1, 361, 121, 4, 9, 4]', 'square(&[6, -3, 12, 23, 4, 1, 19, 11, 2, 3, 2])', 'vec![36, 9, 144, 529, 16, 1, 361, 121, 4, 9, 4]', true),
        tc('square(&[0, -1, 1])', '[0, 1, 1]', 'square(&[0, -1, 1])', 'vec![0, 1, 1]', true),
        tc('square(&[-9])', '[81]', 'square(&[-9])', 'vec![81]', true),
        tc('square(&[2, 4, 6, 8])', '[4, 16, 36, 64]', 'square(&[2, 4, 6, 8])', 'vec![4, 16, 36, 64]', true),
        tc('square(&[100])', '[10000]', 'square(&[100])', 'vec![10000]', true),
        tc('square(&[-5, -4, -3])', '[25, 16, 9]', 'square(&[-5, -4, -3])', 'vec![25, 16, 9]', true),
        tc('square(&[7, 0, 7])', '[49, 0, 49]', 'square(&[7, 0, 7])', 'vec![49, 0, 49]', true),
      ],
    },
    {
      id: 'rust-functional-1-add-star',
      slug: 'add_star',
      language: 'rust',
      sectionId: 'functional-1',
      title: 'add_star',
      difficulty: 235,
      doc: 'Given a slice of string slices `strings`, return a `Vec<String>` where each string has `"*"` added at its end.',
      functionName: 'add_star',
      starterCode: `pub fn add_star(strings: &[&str]) -> Vec<String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Map each `&s` in `strings.iter()` using `format!("{s}*")`.',
          snippet: 'strings.iter().map(|&s| format!("{s}*")).collect()',
        },
        {
          text: 'Notice `""` becomes `"*"`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn add_star(strings: &[&str]) -> Vec<String> {\n    strings.iter().map(|&s| format!("{s}*")).collect()\n}`,
      tests: [
        tc('add_star(&["a", "bb", "ccc"])', dispVecStr(['a*', 'bb*', 'ccc*']), 'add_star(&["a", "bb", "ccc"])', rsVecStr(['a*', 'bb*', 'ccc*'])),
        tc('add_star(&["hello", "there"])', dispVecStr(['hello*', 'there*']), 'add_star(&["hello", "there"])', rsVecStr(['hello*', 'there*'])),
        tc('add_star(&["*"])', dispVecStr(['**']), 'add_star(&["*"])', rsVecStr(['**'])),
        tc('add_star(&[])', '[]', 'add_star(&[])', rsVecStr([])),
        tc('add_star(&[""])', dispVecStr(['*']), 'add_star(&[""])', rsVecStr(['*'])),
        tc('add_star(&["kittens", "and", "chocolate", "and"])', dispVecStr(['kittens*', 'and*', 'chocolate*', 'and*']), 'add_star(&["kittens", "and", "chocolate", "and"])', rsVecStr(['kittens*', 'and*', 'chocolate*', 'and*']), true),
        tc('add_star(&["empty", "string", ""])', dispVecStr(['empty*', 'string*', '*']), 'add_star(&["empty", "string", ""])', rsVecStr(['empty*', 'string*', '*']), true),
        tc('add_star(&["rust"])', dispVecStr(['rust*']), 'add_star(&["rust"])', rsVecStr(['rust*']), true),
        tc('add_star(&["*", "**"])', dispVecStr(['**', '***']), 'add_star(&["*", "**"])', rsVecStr(['**', '***']), true),
        tc('add_star(&["1", "2", "3"])', dispVecStr(['1*', '2*', '3*']), 'add_star(&["1", "2", "3"])', rsVecStr(['1*', '2*', '3*']), true),
        tc('add_star(&["x y"])', dispVecStr(['x y*']), 'add_star(&["x y"])', rsVecStr(['x y*']), true),
        tc('add_star(&["fn", "pub"])', dispVecStr(['fn*', 'pub*']), 'add_star(&["fn", "pub"])', rsVecStr(['fn*', 'pub*']), true),
      ],
    },
    {
      id: 'rust-functional-1-copies3',
      slug: 'copies3',
      language: 'rust',
      sectionId: 'functional-1',
      title: 'copies3',
      difficulty: 250,
      doc: 'Given a slice of string slices `strings`, return a `Vec<String>` where each string is replaced by `3` copies of the string concatenated together.',
      functionName: 'copies3',
      starterCode: `pub fn copies3(strings: &[&str]) -> Vec<String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `s.repeat(3)` inside `.map(|&s| s.repeat(3))`.',
          snippet: 'strings.iter().map(|&s| s.repeat(3)).collect()',
        },
        {
          text: '`"".repeat(3)` returns `""` cleanly.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn copies3(strings: &[&str]) -> Vec<String> {\n    strings.iter().map(|&s| s.repeat(3)).collect()\n}`,
      tests: [
        tc('copies3(&["a", "bb", "ccc"])', dispVecStr(['aaa', 'bbbbbb', 'ccccccccc']), 'copies3(&["a", "bb", "ccc"])', rsVecStr(['aaa', 'bbbbbb', 'ccccccccc'])),
        tc('copies3(&["24", "a", ""])', dispVecStr(['242424', 'aaa', '']), 'copies3(&["24", "a", ""])', rsVecStr(['242424', 'aaa', ''])),
        tc('copies3(&["hello", "there"])', dispVecStr(['hellohellohello', 'theretherethere']), 'copies3(&["hello", "there"])', rsVecStr(['hellohellohello', 'theretherethere'])),
        tc('copies3(&["no"])', dispVecStr(['nonono']), 'copies3(&["no"])', rsVecStr(['nonono'])),
        tc('copies3(&[])', '[]', 'copies3(&[])', rsVecStr([])),
        tc('copies3(&["this", "and", "that", "and"])', dispVecStr(['thisthisthis', 'andandand', 'thatthatthat', 'andandand']), 'copies3(&["this", "and", "that", "and"])', rsVecStr(['thisthisthis', 'andandand', 'thatthatthat', 'andandand']), true),
        tc('copies3(&[""])', dispVecStr(['']), 'copies3(&[""])', rsVecStr(['']), true),
        tc('copies3(&["rs"])', dispVecStr(['rsrsrs']), 'copies3(&["rs"])', rsVecStr(['rsrsrs']), true),
        tc('copies3(&["!"])', dispVecStr(['!!!']), 'copies3(&["!"])', rsVecStr(['!!!']), true),
        tc('copies3(&["ab", "cd"])', dispVecStr(['ababab', 'cdcdcd']), 'copies3(&["ab", "cd"])', rsVecStr(['ababab', 'cdcdcd']), true),
        tc('copies3(&["0", "1"])', dispVecStr(['000', '111']), 'copies3(&["0", "1"])', rsVecStr(['000', '111']), true),
        tc('copies3(&[" "])', dispVecStr(['   ']), 'copies3(&[" "])', rsVecStr(['   ']), true),
      ],
    },
    {
      id: 'rust-functional-1-more-y',
      slug: 'more_y',
      language: 'rust',
      sectionId: 'functional-1',
      title: 'more_y',
      difficulty: 265,
      doc: 'Given a slice of string slices `strings`, return a `Vec<String>` where each string has `"y"` added at its start and end.',
      functionName: 'more_y',
      starterCode: `pub fn more_y(strings: &[&str]) -> Vec<String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `format!("y{s}y")` inside `.map(...)`.',
          snippet: 'strings.iter().map(|&s| format!("y{s}y")).collect()',
        },
        {
          text: 'Notice an empty string `""` becomes `"yy"`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn more_y(strings: &[&str]) -> Vec<String> {\n    strings.iter().map(|&s| format!("y{s}y")).collect()\n}`,
      tests: [
        tc('more_y(&["a", "b", "c"])', dispVecStr(['yay', 'yby', 'ycy']), 'more_y(&["a", "b", "c"])', rsVecStr(['yay', 'yby', 'ycy'])),
        tc('more_y(&["hello", "there"])', dispVecStr(['yhelloy', 'ytherey']), 'more_y(&["hello", "there"])', rsVecStr(['yhelloy', 'ytherey'])),
        tc('more_y(&["yay"])', dispVecStr(['yyayy']), 'more_y(&["yay"])', rsVecStr(['yyayy'])),
        tc('more_y(&["", "a", "xx"])', dispVecStr(['yy', 'yay', 'yxxy']), 'more_y(&["", "a", "xx"])', rsVecStr(['yy', 'yay', 'yxxy'])),
        tc('more_y(&[])', '[]', 'more_y(&[])', rsVecStr([])),
        tc('more_y(&["xx", "yy", "zz"])', dispVecStr(['yxxy', 'yyyy', 'yzzy']), 'more_y(&["xx", "yy", "zz"])', rsVecStr(['yxxy', 'yyyy', 'yzzy']), true),
        tc('more_y(&["y"])', dispVecStr(['yyy']), 'more_y(&["y"])', rsVecStr(['yyy']), true),
        tc('more_y(&[""])', dispVecStr(['yy']), 'more_y(&[""])', rsVecStr(['yy']), true),
        tc('more_y(&["rust"])', dispVecStr(['yrusty']), 'more_y(&["rust"])', rsVecStr(['yrusty']), true),
        tc('more_y(&["1", "2"])', dispVecStr(['y1y', 'y2y']), 'more_y(&["1", "2"])', rsVecStr(['y1y', 'y2y']), true),
        tc('more_y(&["Y"])', dispVecStr(['yYy']), 'more_y(&["Y"])', rsVecStr(['yYy']), true),
        tc('more_y(&["ok", "go"])', dispVecStr(['yoky', 'ygoy']), 'more_y(&["ok", "go"])', rsVecStr(['yoky', 'ygoy']), true),
      ],
    },
    {
      id: 'rust-functional-1-right-digit',
      slug: 'right_digit',
      language: 'rust',
      sectionId: 'functional-1',
      title: 'right_digit',
      difficulty: 285,
      doc: 'Given a slice of non-negative `i32` integers `nums`, return a `Vec<i32>` of the rightmost decimal digits (`x % 10`).',
      functionName: 'right_digit',
      starterCode: `pub fn right_digit(nums: &[i32]) -> Vec<i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'For non-negative integers, `x % 10` extracts the ones digit.',
          snippet: 'nums.iter().map(|&x| x % 10).collect()',
        },
        {
          text: 'Chain `.iter().map(|&x| x % 10).collect()`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn right_digit(nums: &[i32]) -> Vec<i32> {\n    nums.iter().map(|&x| x % 10).collect()\n}`,
      tests: [
        tc('right_digit(&[1, 22, 93])', '[1, 2, 3]', 'right_digit(&[1, 22, 93])', 'vec![1, 2, 3]'),
        tc('right_digit(&[16, 8, 886, 8, 1])', '[6, 8, 6, 8, 1]', 'right_digit(&[16, 8, 886, 8, 1])', 'vec![6, 8, 6, 8, 1]'),
        tc('right_digit(&[10, 0])', '[0, 0]', 'right_digit(&[10, 0])', 'vec![0, 0]'),
        tc('right_digit(&[])', '[]', 'right_digit(&[])', 'Vec::<i32>::new()'),
        tc('right_digit(&[5, 10])', '[5, 0]', 'right_digit(&[5, 10])', 'vec![5, 0]'),
        tc('right_digit(&[5, 50, 500, 5000, 5000])', '[5, 0, 0, 0, 0]', 'right_digit(&[5, 50, 500, 5000, 5000])', 'vec![5, 0, 0, 0, 0]', true),
        tc('right_digit(&[6, 23, 12, 23, 4, 1, 19, 1119, 2, 3, 2])', '[6, 3, 2, 3, 4, 1, 9, 9, 2, 3, 2]', 'right_digit(&[6, 23, 12, 23, 4, 1, 19, 1119, 2, 3, 2])', 'vec![6, 3, 2, 3, 4, 1, 9, 9, 2, 3, 2]', true),
        tc('right_digit(&[999])', '[9]', 'right_digit(&[999])', 'vec![9]', true),
        tc('right_digit(&[0])', '[0]', 'right_digit(&[0])', 'vec![0]', true),
        tc('right_digit(&[42, 17, 100])', '[2, 7, 0]', 'right_digit(&[42, 17, 100])', 'vec![2, 7, 0]', true),
        tc('right_digit(&[7])', '[7]', 'right_digit(&[7])', 'vec![7]', true),
        tc('right_digit(&[11, 12, 13, 14])', '[1, 2, 3, 4]', 'right_digit(&[11, 12, 13, 14])', 'vec![1, 2, 3, 4]', true),
      ],
    },
  ],
};
