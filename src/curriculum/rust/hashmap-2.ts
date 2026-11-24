import type { SectionSpec, TestCase } from '../../types/schema';

function rsSliceStr(items: string[]): string {
  return `&[${items.map((s) => JSON.stringify(s)).join(', ')}]`;
}

function rsMapInt(pairs: [string, number][]): string {
  if (pairs.length === 0) {
    return 'std::collections::HashMap::<String, i32>::new()';
  }
  const inner = pairs
    .map(([k, v]) => `(${JSON.stringify(k)}.to_string(), ${v}i32)`)
    .join(', ');
  return `std::collections::HashMap::from([${inner}])`;
}

function dispMapInt(pairs: [string, number][]): string {
  const inner = pairs.map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(', ');
  return `{${inner}}`;
}

function rsMapStr(pairs: [string, string][]): string {
  if (pairs.length === 0) {
    return 'std::collections::HashMap::<String, String>::new()';
  }
  const inner = pairs
    .map(([k, v]) => `(${JSON.stringify(k)}.to_string(), ${JSON.stringify(v)}.to_string())`)
    .join(', ');
  return `std::collections::HashMap::from([${inner}])`;
}

function dispMapStr(pairs: [string, string][]): string {
  const inner = pairs
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(', ');
  return `{${inner}}`;
}

function tcIntMap(
  fnName: string,
  input: string[],
  expected: [string, number][],
  hidden = false
): TestCase {
  const sliceStr = rsSliceStr(input);
  const call = `${fnName}(${sliceStr})`;
  const expectedDisplay = dispMapInt(expected);
  const rustCallExpr = `${fnName}(${sliceStr})`;
  const rustExpectedExpr = rsMapInt(expected);
  return hidden
    ? { call, expectedDisplay, rustCallExpr, rustExpectedExpr, hidden: true }
    : { call, expectedDisplay, rustCallExpr, rustExpectedExpr };
}

function tcStrMap(
  fnName: string,
  input: string[],
  expected: [string, string][],
  hidden = false
): TestCase {
  const sliceStr = rsSliceStr(input);
  const call = `${fnName}(${sliceStr})`;
  const expectedDisplay = dispMapStr(expected);
  const rustCallExpr = `${fnName}(${sliceStr})`;
  const rustExpectedExpr = rsMapStr(expected);
  return hidden
    ? { call, expectedDisplay, rustCallExpr, rustExpectedExpr, hidden: true }
    : { call, expectedDisplay, rustCallExpr, rustExpectedExpr };
}

function tcStrOut(
  fnName: string,
  input: string[],
  expected: string,
  hidden = false
): TestCase {
  const sliceStr = rsSliceStr(input);
  const call = `${fnName}(${sliceStr})`;
  const expectedDisplay = JSON.stringify(expected);
  const rustCallExpr = `${fnName}(${sliceStr})`;
  const rustExpectedExpr = `${JSON.stringify(expected)}.to_string()`;
  return hidden
    ? { call, expectedDisplay, rustCallExpr, rustExpectedExpr, hidden: true }
    : { call, expectedDisplay, rustCallExpr, rustExpectedExpr };
}

export const hashmap2Section: SectionSpec = {
  id: 'hashmap-2',
  language: 'rust',
  title: 'HashMap-2',
  description:
    'Building `HashMap` tables over slices using loops and Rust\'s powerful `.entry(key).or_insert(...)` API for frequency counts and grouping.',
  difficultyRange: [250, 349],
  problems: [
    {
      id: 'rust-hashmap-2-word0',
      slug: 'word0',
      language: 'rust',
      sectionId: 'hashmap-2',
      title: 'word0',
      difficulty: 255,
      doc: 'Given a slice of string slices `strings`, return a `HashMap<String, i32>` containing a key for every distinct string in `strings`, always with the value `0`.',
      functionName: 'word0',
      starterCode: `use std::collections::HashMap;\n\npub fn word0(strings: &[&str]) -> HashMap<String, i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Create `let mut map = HashMap::new();` and loop `for &s in strings`.',
          snippet: 'for &s in strings {\n    map.entry(s.to_string()).or_insert(0);\n}',
        },
        {
          text: 'Either `map.insert(s.to_string(), 0)` or `map.entry(s.to_string()).or_insert(0)` maps every unique key to `0`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn word0(strings: &[&str]) -> HashMap<String, i32> {\n    let mut map = HashMap::new();\n    for &s in strings {\n        map.entry(s.to_string()).or_insert(0);\n    }\n    map\n}`,
      tests: [
        tcIntMap('word0', ['a', 'b', 'a', 'b'], [['a', 0], ['b', 0]]),
        tcIntMap('word0', ['a', 'b', 'a', 'c', 'b'], [['a', 0], ['b', 0], ['c', 0]]),
        tcIntMap('word0', ['c', 'b', 'a'], [['a', 0], ['b', 0], ['c', 0]]),
        tcIntMap('word0', ['c', 'c', 'c', 'c'], [['c', 0]]),
        tcIntMap('word0', [], []),
        tcIntMap('word0', ['rust'], [['rust', 0]], true),
        tcIntMap('word0', [''], [['', 0]], true),
        tcIntMap('word0', ['x', 'y', 'z', 'x'], [['x', 0], ['y', 0], ['z', 0]], true),
        tcIntMap('word0', ['hello', 'world'], [['hello', 0], ['world', 0]], true),
        tcIntMap('word0', ['A', 'a'], [['A', 0], ['a', 0]], true),
        tcIntMap('word0', ['1', '2', '1'], [['1', 0], ['2', 0]], true),
        tcIntMap('word0', ['fn', 'let', 'mut'], [['fn', 0], ['let', 0], ['mut', 0]], true),
      ],
    },
    {
      id: 'rust-hashmap-2-word-len',
      slug: 'word_len',
      language: 'rust',
      sectionId: 'hashmap-2',
      title: 'word_len',
      difficulty: 270,
      doc: 'Given a slice of string slices `strings`, return a `HashMap<String, i32>` containing a key for every distinct string in `strings`, mapped to that string\'s character length (`s.chars().count() as i32`).',
      functionName: 'word_len',
      starterCode: `use std::collections::HashMap;\n\npub fn word_len(strings: &[&str]) -> HashMap<String, i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Loop over `strings` and insert `(s.to_string(), s.chars().count() as i32)`.',
          snippet: 'for &s in strings {\n    map.entry(s.to_string()).or_insert_with(|| s.chars().count() as i32);\n}',
        },
        {
          text: '`.or_insert_with(...)` avoids recomputing for duplicate strings!',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn word_len(strings: &[&str]) -> HashMap<String, i32> {\n    let mut map = HashMap::new();\n    for &s in strings {\n        map.entry(s.to_string())\n            .or_insert_with(|| s.chars().count() as i32);\n    }\n    map\n}`,
      tests: [
        tcIntMap('word_len', ['a', 'bb', 'a', 'bb'], [['a', 1], ['bb', 2]]),
        tcIntMap('word_len', ['this', 'and', 'that', 'and'], [['and', 3], ['that', 4], ['this', 4]]),
        tcIntMap('word_len', ['code', 'code', 'code', 'bug'], [['bug', 3], ['code', 4]]),
        tcIntMap('word_len', [], []),
        tcIntMap('word_len', ['z'], [['z', 1]]),
        tcIntMap('word_len', [''], [['', 0]], true),
        tcIntMap('word_len', ['rust', 'borrow', 'slice'], [['borrow', 6], ['rust', 4], ['slice', 5]], true),
        tcIntMap('word_len', ['one', 'two', 'three'], [['one', 3], ['three', 5], ['two', 3]], true),
        tcIntMap('word_len', ['x', 'xx', 'xxx'], [['x', 1], ['xx', 2], ['xxx', 3]], true),
        tcIntMap('word_len', ['same', 'same'], [['same', 4]], true),
        tcIntMap('word_len', ['hi', ''], [['', 0], ['hi', 2]], true),
        tcIntMap('word_len', ['alpha', 'beta'], [['alpha', 5], ['beta', 4]], true),
      ],
    },
    {
      id: 'rust-hashmap-2-pairs',
      slug: 'pairs',
      language: 'rust',
      sectionId: 'hashmap-2',
      title: 'pairs',
      difficulty: 285,
      doc: 'Given a slice of non-empty string slices `strings`, create and return a `HashMap<String, String>` as follows: for each non-empty string, add its first character as a key with its last character as the value (later strings with the same first character overwrite earlier ones).',
      functionName: 'pairs',
      starterCode: `use std::collections::HashMap;\n\npub fn pairs(strings: &[&str]) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Extract the first and last `char` using `s.chars().next()` and `s.chars().next_back()`.',
          snippet: 'if let (Some(first), Some(last)) = (s.chars().next(), s.chars().next_back()) {\n    map.insert(first.to_string(), last.to_string());\n}',
        },
        {
          text: 'For a 1-character string like `"a"`, both `first` and `last` are `\'a\'`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn pairs(strings: &[&str]) -> HashMap<String, String> {\n    let mut map = HashMap::new();\n    for &s in strings {\n        if let (Some(first), Some(last)) = (s.chars().next(), s.chars().next_back()) {\n            map.insert(first.to_string(), last.to_string());\n        }\n    }\n    map\n}`,
      tests: [
        tcStrMap('pairs', ['code', 'bug'], [['b', 'g'], ['c', 'e']]),
        tcStrMap('pairs', ['man', 'moon', 'main'], [['m', 'n']]),
        tcStrMap('pairs', ['man', 'moon', 'good', 'night'], [['g', 'd'], ['m', 'n'], ['n', 't']]),
        tcStrMap('pairs', [], []),
        tcStrMap('pairs', ['a', 'b'], [['a', 'a'], ['b', 'b']]),
        tcStrMap('pairs', ['are', 'codes', 'and', 'cods'], [['a', 'd'], ['c', 's']], true),
        tcStrMap('pairs', ['apple', 'banana'], [['a', 'e'], ['b', 'a']], true),
        tcStrMap('pairs', ['cat', 'car', 'cab'], [['c', 'b']], true),
        tcStrMap('pairs', ['x'], [['x', 'x']], true),
        tcStrMap('pairs', ['rust', 'ruby'], [['r', 'y']], true),
        tcStrMap('pairs', ['hi', 'ho', 'he'], [['h', 'e']], true),
        tcStrMap('pairs', ['dog', 'deer', 'duck'], [['d', 'k']], true),
      ],
    },
    {
      id: 'rust-hashmap-2-word-count',
      slug: 'word_count',
      language: 'rust',
      sectionId: 'hashmap-2',
      title: 'word_count',
      difficulty: 305,
      doc: 'The classic word-count algorithm: given a slice of string slices `strings`, return a `HashMap<String, i32>` with a key for each distinct string and the value equal to the number of times that string appears in `strings`.',
      note: 'Rust\'s `*map.entry(s.to_string()).or_insert(0) += 1;` updates frequency counts in a single hash lookup!',
      functionName: 'word_count',
      starterCode: `use std::collections::HashMap;\n\npub fn word_count(strings: &[&str]) -> HashMap<String, i32> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `.entry(s.to_string()).or_insert(0)` to get an `&mut i32` reference to the count and increment it.',
          snippet: '*map.entry(s.to_string()).or_insert(0) += 1;',
        },
        {
          text: 'Return `map` after iterating through all elements of `strings`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn word_count(strings: &[&str]) -> HashMap<String, i32> {\n    let mut map = HashMap::new();\n    for &s in strings {\n        *map.entry(s.to_string()).or_insert(0) += 1;\n    }\n    map\n}`,
      tests: [
        tcIntMap('word_count', ['a', 'b', 'a', 'c', 'b'], [['a', 2], ['b', 2], ['c', 1]]),
        tcIntMap('word_count', ['c', 'b', 'a'], [['a', 1], ['b', 1], ['c', 1]]),
        tcIntMap('word_count', ['c', 'c', 'c', 'c'], [['c', 4]]),
        tcIntMap('word_count', [], []),
        tcIntMap('word_count', ['this', 'and', 'this', ''], [['', 1], ['and', 1], ['this', 2]]),
        tcIntMap('word_count', ['x', 'y', 'x', 'Y', 'X'], [['X', 1], ['Y', 1], ['x', 2], ['y', 1]], true),
        tcIntMap('word_count', ['123', '0', '123', '1'], [['0', 1], ['1', 1], ['123', 2]], true),
        tcIntMap('word_count', ['d', 'a', 'e', 'd', 'a', 'd', 'b', 'b', 'z'], [['a', 2], ['b', 2], ['d', 3], ['e', 1], ['z', 1]], true),
        tcIntMap('word_count', ['apple', 'banana', 'apple', 'apple', 'banana'], [['apple', 3], ['banana', 2]], true),
        tcIntMap('word_count', ['solo'], [['solo', 1]], true),
        tcIntMap('word_count', ['', ''], [['', 2]], true),
        tcIntMap('word_count', ['rs', 'js', 'rs', 'cobol'], [['cobol', 1], ['js', 1], ['rs', 2]], true),
      ],
    },
    {
      id: 'rust-hashmap-2-first-char',
      slug: 'first_char',
      language: 'rust',
      sectionId: 'hashmap-2',
      title: 'first_char',
      difficulty: 325,
      doc: 'Given a slice of non-empty string slices `strings`, return a `HashMap<String, String>` with a key for every distinct first character seen, with the value of all the strings starting with that character appended together in the order they appear in `strings`.',
      functionName: 'first_char',
      starterCode: `use std::collections::HashMap;\n\npub fn first_char(strings: &[&str]) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Get `first` via `s.chars().next()`, then append `s` onto the map entry\'s `String` buffer!',
          snippet: 'if let Some(ch) = s.chars().next() {\n    map.entry(ch.to_string()).or_default().push_str(s);\n}',
        },
        {
          text: '`.or_default()` inserts `String::new()` on first sight and returns `&mut String` so `.push_str(s)` appends in place.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn first_char(strings: &[&str]) -> HashMap<String, String> {\n    let mut map: HashMap<String, String> = HashMap::new();\n    for &s in strings {\n        if let Some(ch) = s.chars().next() {\n            map.entry(ch.to_string()).or_default().push_str(s);\n        }\n    }\n    map\n}`,
      tests: [
        tcStrMap('first_char', ['salt', 'tea', 'soda', 'toast'], [['s', 'saltsoda'], ['t', 'teatoast']]),
        tcStrMap('first_char', ['aa', 'bb', 'cc', 'aAA', 'cCC', 'd'], [['a', 'aaaAA'], ['b', 'bb'], ['c', 'cccCC'], ['d', 'd']]),
        tcStrMap('first_char', [], []),
        tcStrMap('first_char', ['apple', 'bells', 'salt', 'aardvark', 'bells', 'sun', 'zen', 'bells'], [['a', 'appleaardvark'], ['b', 'bellsbellsbells'], ['s', 'saltsun'], ['z', 'zen']]),
        tcStrMap('first_char', ['rust'], [['r', 'rust']]),
        tcStrMap('first_char', ['a', 'a', 'a'], [['a', 'aaa']], true),
        tcStrMap('first_char', ['A', 'a'], [['A', 'A'], ['a', 'a']], true),
        tcStrMap('first_char', ['cat', 'car', 'dog', 'door'], [['c', 'catcar'], ['d', 'dogdoor']], true),
        tcStrMap('first_char', ['10', '15', '20'], [['1', '1015'], ['2', '20']], true),
        tcStrMap('first_char', ['x', 'y', 'z'], [['x', 'x'], ['y', 'y'], ['z', 'z']], true),
        tcStrMap('first_char', ['hi', 'ho', 'hum'], [['h', 'hihohum']], true),
        tcStrMap('first_char', ['beta', 'alpha', 'beta'], [['a', 'alpha'], ['b', 'betabeta']], true),
      ],
    },
    {
      id: 'rust-hashmap-2-word-append',
      slug: 'word_append',
      language: 'rust',
      sectionId: 'hashmap-2',
      title: 'word_append',
      difficulty: 345,
      doc: 'Loop over the given `strings` slice to build a `String` result like this: when a string appears the 2nd, 4th, 6th, etc. time in `strings`, append that string to the result. Return the empty string `""` if no string appears a 2nd time.',
      note: 'Import `use std::collections::HashMap;` at the top of your solution to count occurrences of each string.',
      functionName: 'word_append',
      starterCode: `pub fn word_append(strings: &[&str]) -> String {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use a `HashMap<&str, i32>` (or `HashMap<String, i32>`) to track how many times each string has been seen so far.',
          snippet: 'let count = counts.entry(s).or_insert(0);\n*count += 1;\nif *count % 2 == 0 {\n    out.push_str(s);\n}',
        },
        {
          text: 'Notice `HashMap<&str, i32>` borrows keys directly from `strings` without allocating key `String`s!',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn word_append(strings: &[&str]) -> String {\n    let mut counts: HashMap<&str, i32> = HashMap::new();\n    let mut out = String::new();\n    for &s in strings {\n        let count = counts.entry(s).or_insert(0);\n        *count += 1;\n        if *count % 2 == 0 {\n            out.push_str(s);\n        }\n    }\n    out\n}`,
      tests: [
        tcStrOut('word_append', ['a', 'b', 'a'], 'a'),
        tcStrOut('word_append', ['a', 'b', 'a', 'c', 'a', 'd', 'a'], 'aa'),
        tcStrOut('word_append', ['a', '', 'a'], 'a'),
        tcStrOut('word_append', [], ''),
        tcStrOut('word_append', ['a', 'b', 'b', 'a', 'a'], 'ba'),
        tcStrOut('word_append', ['a', 'b', 'b', 'b', 'a', 'c', 'a', 'a'], 'baa', true),
        tcStrOut('word_append', ['a', 'b', 'b', 'b', 'a', 'c', 'a', 'a', 'a', 'b', 'a'], 'baaba', true),
        tcStrOut('word_append', ['not', 'and', 'or', 'and', 'this', 'and', 'or', 'that', 'not'], 'andornot', true),
        tcStrOut('word_append', ['a', 'b', 'c'], '', true),
        tcStrOut('word_append', ['this', 'or', 'that', 'and', 'this', 'and', 'that'], 'thisandthat', true),
        tcStrOut('word_append', ['xx', 'xx', 'yy', 'xx', 'zz', 'yy', 'zz', 'xx'], 'xxyyzzxx', true),
        tcStrOut('word_append', ['rs', 'rs', 'rs'], 'rs', true),
      ],
    },
  ],
};
