import type { SectionSpec, TestCase } from '../../types/schema';

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

function mapTc(
  fnName: string,
  input: [string, string][],
  expected: [string, string][],
  hidden = false
): TestCase {
  const call = `${fnName}(${dispMapStr(input)})`;
  const expectedDisplay = dispMapStr(expected);
  const rustCallExpr = `${fnName}(${rsMapStr(input)})`;
  const rustExpectedExpr = rsMapStr(expected);
  return hidden
    ? { call, expectedDisplay, rustCallExpr, rustExpectedExpr, hidden: true }
    : { call, expectedDisplay, rustCallExpr, rustExpectedExpr };
}

export const hashmap1Section: SectionSpec = {
  id: 'hashmap-1',
  language: 'rust',
  title: 'HashMap-1',
  description:
    'Direct `HashMap<String, String>` lookups and updates using `.get()`, `.insert()`, `.remove()`, and `.contains_key()` — no loops needed.',
  difficultyRange: [150, 249],
  problems: [
    {
      id: 'rust-hashmap-1-map-bully',
      slug: 'map_bully',
      language: 'rust',
      sectionId: 'hashmap-1',
      title: 'map_bully',
      difficulty: 155,
      doc: 'Modify and return the given `map`: if the key `"a"` is present in `map`, set the key `"b"` to have `"a"`\'s value and set the key `"a"` to `""`. Return the updated `HashMap`.',
      note: 'Because `map` is passed by value, write `let mut map = map;` to mutate it in place without reallocating a new `HashMap`.',
      functionName: 'map_bully',
      starterCode: `use std::collections::HashMap;\n\npub fn map_bully(map: HashMap<String, String>) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Clone `"a"`\'s value out first (or use `.get_mut("a")` with `std::mem::take`) so the borrow of `map` ends before calling `map.insert(...)`.',
          snippet: 'let mut map = map;\nif let Some(val) = map.get("a").cloned() {\n    map.insert("b".to_string(), val);\n    map.insert("a".to_string(), String::new());\n}',
        },
        {
          text: 'Even cleaner: `if let Some(a_val) = map.get_mut("a") { let taken = std::mem::take(a_val); map.insert("b".to_string(), taken); }` avoids cloning altogether!',
        },
      ],
      showsolution: true,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn map_bully(map: HashMap<String, String>) -> HashMap<String, String> {\n    let mut map = map;\n    if let Some(a_val) = map.get_mut("a") {\n        let taken = std::mem::take(a_val);\n        map.insert("b".to_string(), taken);\n    }\n    map\n}`,
      tests: [
        mapTc('map_bully', [['a', 'candy'], ['b', 'dirt']], [['a', ''], ['b', 'candy']]),
        mapTc('map_bully', [['a', 'candy']], [['a', ''], ['b', 'candy']]),
        mapTc('map_bully', [['a', 'candy'], ['b', 'carrot'], ['c', 'meh']], [['a', ''], ['b', 'candy'], ['c', 'meh']]),
        mapTc('map_bully', [['b', 'carrot']], [['b', 'carrot']]),
        mapTc('map_bully', [['c', 'meh']], [['c', 'meh']]),
        mapTc('map_bully', [['a', 'sparkle'], ['c', 'meh']], [['a', ''], ['b', 'sparkle'], ['c', 'meh']], true),
        mapTc('map_bully', [], [], true),
        mapTc('map_bully', [['a', ''], ['b', 'dirt']], [['a', ''], ['b', '']], true),
        mapTc('map_bully', [['a', 'rust']], [['a', ''], ['b', 'rust']], true),
        mapTc('map_bully', [['b', 'keep'], ['c', 'stay']], [['b', 'keep'], ['c', 'stay']], true),
        mapTc('map_bully', [['a', 'x'], ['b', 'x']], [['a', ''], ['b', 'x']], true),
        mapTc('map_bully', [['z', 'last']], [['z', 'last']], true),
      ],
    },
    {
      id: 'rust-hashmap-1-map-share',
      slug: 'map_share',
      language: 'rust',
      sectionId: 'hashmap-1',
      title: 'map_share',
      difficulty: 170,
      doc: 'Modify and return the given `map`: if the key `"a"` is present in `map`, set the key `"b"` to have the same value as `"a"`. In all cases, remove the key `"c"`, leaving the rest of the map unchanged.',
      functionName: 'map_share',
      starterCode: `use std::collections::HashMap;\n\npub fn map_share(map: HashMap<String, String>) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `if let Some(val) = map.get("a").cloned()` to copy `"a"`\'s value into `"b"`.',
          snippet: 'if let Some(val) = map.get("a").cloned() {\n    map.insert("b".to_string(), val);\n}\nmap.remove("c");',
        },
        {
          text: 'Call `map.remove("c")` unconditionally — removing a missing key is a safe no-op.',
        },
      ],
      showsolution: true,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn map_share(map: HashMap<String, String>) -> HashMap<String, String> {\n    let mut map = map;\n    if let Some(val) = map.get("a").cloned() {\n        map.insert("b".to_string(), val);\n    }\n    map.remove("c");\n    map\n}`,
      tests: [
        mapTc('map_share', [['a', 'aaa'], ['b', 'bbb'], ['c', 'ccc']], [['a', 'aaa'], ['b', 'aaa']]),
        mapTc('map_share', [['b', 'xyz'], ['c', 'ccc']], [['b', 'xyz']]),
        mapTc('map_share', [['a', 'aaa'], ['c', 'meh'], ['d', 'hi']], [['a', 'aaa'], ['b', 'aaa'], ['d', 'hi']]),
        mapTc('map_share', [['a', 'xyz'], ['b', '1234'], ['c', 'yo'], ['z', 'zzz']], [['a', 'xyz'], ['b', 'xyz'], ['z', 'zzz']]),
        mapTc('map_share', [['c', 'only']], []),
        mapTc('map_share', [], [], true),
        mapTc('map_share', [['a', 'xyz'], ['b', '1234'], ['c', 'yo'], ['d', 'ddd'], ['e', 'everything']], [['a', 'xyz'], ['b', 'xyz'], ['d', 'ddd'], ['e', 'everything']], true),
        mapTc('map_share', [['a', '']], [['a', ''], ['b', '']], true),
        mapTc('map_share', [['b', 'solo']], [['b', 'solo']], true),
        mapTc('map_share', [['d', 'keep']], [['d', 'keep']], true),
        mapTc('map_share', [['a', 'same'], ['c', 'drop']], [['a', 'same'], ['b', 'same']], true),
        mapTc('map_share', [['b', 'old'], ['c', 'gone'], ['x', 'ok']], [['b', 'old'], ['x', 'ok']], true),
      ],
    },
    {
      id: 'rust-hashmap-1-map-ab',
      slug: 'map_ab',
      language: 'rust',
      sectionId: 'hashmap-1',
      title: 'map_ab',
      difficulty: 185,
      doc: 'Modify and return the given `map`: for this problem the map may or may not contain the `"a"` and `"b"` keys. If BOTH keys are present, append their 2 string values together and store the result under the key `"ab"`.',
      functionName: 'map_ab',
      starterCode: `use std::collections::HashMap;\n\npub fn map_ab(map: HashMap<String, String>) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Match `(map.get("a"), map.get("b"))` to borrow both values simultaneously!',
          snippet: 'if let (Some(a), Some(b)) = (map.get("a"), map.get("b")) {\n    let combined = format!("{a}{b}");\n    map.insert("ab".to_string(), combined);\n}',
        },
        {
          text: 'Notice how `combined` finishes borrowing `map` before `map.insert(...)` mutates `map`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn map_ab(map: HashMap<String, String>) -> HashMap<String, String> {\n    let mut map = map;\n    if let (Some(a), Some(b)) = (map.get("a"), map.get("b")) {\n        let combined = format!("{a}{b}");\n        map.insert("ab".to_string(), combined);\n    }\n    map\n}`,
      tests: [
        mapTc('map_ab', [['a', 'Hi'], ['b', 'There']], [['a', 'Hi'], ['ab', 'HiThere'], ['b', 'There']]),
        mapTc('map_ab', [['a', 'Hi']], [['a', 'Hi']]),
        mapTc('map_ab', [['b', 'There']], [['b', 'There']]),
        mapTc('map_ab', [['c', 'meh']], [['c', 'meh']]),
        mapTc('map_ab', [['a', 'aaa'], ['ab', 'nope'], ['b', 'bbb'], ['c', 'ccc']], [['a', 'aaa'], ['ab', 'aaabbb'], ['b', 'bbb'], ['c', 'ccc']]),
        mapTc('map_ab', [['ab', 'nope'], ['b', 'bbb'], ['c', 'ccc']], [['ab', 'nope'], ['b', 'bbb'], ['c', 'ccc']], true),
        mapTc('map_ab', [], [], true),
        mapTc('map_ab', [['a', ''], ['b', '']], [['a', ''], ['ab', ''], ['b', '']], true),
        mapTc('map_ab', [['a', 'rust'], ['b', 'lang']], [['a', 'rust'], ['ab', 'rustlang'], ['b', 'lang']], true),
        mapTc('map_ab', [['a', '1'], ['b', '2']], [['a', '1'], ['ab', '12'], ['b', '2']], true),
        mapTc('map_ab', [['ab', 'keep']], [['ab', 'keep']], true),
        mapTc('map_ab', [['a', 'left'], ['b', '']], [['a', 'left'], ['ab', 'left'], ['b', '']], true),
      ],
    },
    {
      id: 'rust-hashmap-1-topping1',
      slug: 'topping1',
      language: 'rust',
      sectionId: 'hashmap-1',
      title: 'topping1',
      difficulty: 205,
      doc: 'Given a map of food keys and topping values, modify and return the map as follows: if the key `"ice cream"` is present, set its value to `"cherry"`. In all cases, set the key `"bread"` to have the value `"butter"`.',
      functionName: 'topping1',
      starterCode: `use std::collections::HashMap;\n\npub fn topping1(map: HashMap<String, String>) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `if let Some(v) = map.get_mut("ice cream") { *v = "cherry".to_string(); }` to update an existing entry in place.',
          snippet: 'if let Some(v) = map.get_mut("ice cream") {\n    *v = "cherry".to_string();\n}\nmap.insert("bread".to_string(), "butter".to_string());',
        },
        {
          text: 'Always insert `"bread" -> "butter"` whether or not `"bread"` existed previously.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn topping1(map: HashMap<String, String>) -> HashMap<String, String> {\n    let mut map = map;\n    if let Some(v) = map.get_mut("ice cream") {\n        *v = "cherry".to_string();\n    }\n    map.insert("bread".to_string(), "butter".to_string());\n    map\n}`,
      tests: [
        mapTc('topping1', [['ice cream', 'peanuts']], [['bread', 'butter'], ['ice cream', 'cherry']]),
        mapTc('topping1', [], [['bread', 'butter']]),
        mapTc('topping1', [['pancake', 'syrup']], [['bread', 'butter'], ['pancake', 'syrup']]),
        mapTc('topping1', [['bread', 'dirt'], ['ice cream', 'strawberries']], [['bread', 'butter'], ['ice cream', 'cherry']]),
        mapTc('topping1', [['bread', 'jam'], ['ice cream', 'strawberries'], ['salad', 'oil']], [['bread', 'butter'], ['ice cream', 'cherry'], ['salad', 'oil']]),
        mapTc('topping1', [['bread', 'butter']], [['bread', 'butter']], true),
        mapTc('topping1', [['ice cream', '']], [['bread', 'butter'], ['ice cream', 'cherry']], true),
        mapTc('topping1', [['ice cream', 'cherry']], [['bread', 'butter'], ['ice cream', 'cherry']], true),
        mapTc('topping1', [['soup', 'salt']], [['bread', 'butter'], ['soup', 'salt']], true),
        mapTc('topping1', [['bread', 'honey']], [['bread', 'butter']], true),
        mapTc('topping1', [['waffle', 'maple'], ['ice cream', 'fudge']], [['bread', 'butter'], ['ice cream', 'cherry'], ['waffle', 'maple']], true),
        mapTc('topping1', [['tea', 'lemon']], [['bread', 'butter'], ['tea', 'lemon']], true),
      ],
    },
    {
      id: 'rust-hashmap-1-map-ab2',
      slug: 'map_ab2',
      language: 'rust',
      sectionId: 'hashmap-1',
      title: 'map_ab2',
      difficulty: 225,
      doc: 'Modify and return the given `map`: if the keys `"a"` and `"b"` are both in the map and have equal values, remove them both.',
      functionName: 'map_ab2',
      starterCode: `use std::collections::HashMap;\n\npub fn map_ab2(map: HashMap<String, String>) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Check `let same = matches!((map.get("a"), map.get("b")), (Some(a), Some(b)) if a == b);`.',
          snippet: 'let same = matches!((map.get("a"), map.get("b")), (Some(a), Some(b)) if a == b);\nif same {\n    map.remove("a");\n    map.remove("b");\n}',
        },
        {
          text: 'Remember `map.get("a") == map.get("b")` would be `true` when BOTH keys are `None`, so make sure both are `Some(...)`!',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn map_ab2(map: HashMap<String, String>) -> HashMap<String, String> {\n    let mut map = map;\n    let same = matches!((map.get("a"), map.get("b")), (Some(a), Some(b)) if a == b);\n    if same {\n        map.remove("a");\n        map.remove("b");\n    }\n    map\n}`,
      tests: [
        mapTc('map_ab2', [['a', 'aaa'], ['b', 'aaa'], ['c', 'cake']], [['c', 'cake']]),
        mapTc('map_ab2', [['a', 'aaa'], ['b', 'bbb']], [['a', 'aaa'], ['b', 'bbb']]),
        mapTc('map_ab2', [['a', 'aaa'], ['b', 'bbb'], ['c', 'aaa']], [['a', 'aaa'], ['b', 'bbb'], ['c', 'aaa']]),
        mapTc('map_ab2', [['a', 'aaa']], [['a', 'aaa']]),
        mapTc('map_ab2', [['b', 'bbb']], [['b', 'bbb']]),
        mapTc('map_ab2', [['a', ''], ['b', ''], ['c', 'ccc']], [['c', 'ccc']], true),
        mapTc('map_ab2', [], [], true),
        mapTc('map_ab2', [['a', 'a'], ['b', 'b'], ['z', 'zebra']], [['a', 'a'], ['b', 'b'], ['z', 'zebra']], true),
        mapTc('map_ab2', [['a', 'same'], ['b', 'same']], [], true),
        mapTc('map_ab2', [['c', 'keep']], [['c', 'keep']], true),
        mapTc('map_ab2', [['a', 'x'], ['b', 'X']], [['a', 'x'], ['b', 'X']], true),
        mapTc('map_ab2', [['a', '1'], ['b', '1'], ['d', '2']], [['d', '2']], true),
      ],
    },
    {
      id: 'rust-hashmap-1-map-ab4',
      slug: 'map_ab4',
      language: 'rust',
      sectionId: 'hashmap-1',
      title: 'map_ab4',
      difficulty: 245,
      doc: 'Modify and return the given `map`: if the keys `"a"` and `"b"` are both present and have values with different character lengths, set `"c"` to have the longer value. If both keys exist and their values have the same character length, change both `"a"` and `"b"` to the empty string `""`.',
      functionName: 'map_ab4',
      starterCode: `use std::collections::HashMap;\n\npub fn map_ab4(map: HashMap<String, String>) -> HashMap<String, String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Inspect `(map.get("a"), map.get("b"))` using `std::cmp::Ordering` on `a.chars().count().cmp(&b.chars().count())`!',
          snippet: 'if let (Some(a), Some(b)) = (map.get("a").cloned(), map.get("b").cloned()) {\n    match a.chars().count().cmp(&b.chars().count()) { ... }\n}',
        },
        {
          text: 'If either `"a"` or `"b"` is missing from `map`, leave `map` completely untouched.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `use std::collections::HashMap;\n\npub fn map_ab4(map: HashMap<String, String>) -> HashMap<String, String> {\n    let mut map = map;\n    if let (Some(a), Some(b)) = (map.get("a").cloned(), map.get("b").cloned()) {\n        match a.chars().count().cmp(&b.chars().count()) {\n            std::cmp::Ordering::Greater => {\n                map.insert("c".to_string(), a);\n            }\n            std::cmp::Ordering::Less => {\n                map.insert("c".to_string(), b);\n            }\n            std::cmp::Ordering::Equal => {\n                map.insert("a".to_string(), String::new());\n                map.insert("b".to_string(), String::new());\n            }\n        }\n    }\n    map\n}`,
      tests: [
        mapTc('map_ab4', [['a', 'aaa'], ['b', 'bb'], ['c', 'cake']], [['a', 'aaa'], ['b', 'bb'], ['c', 'aaa']]),
        mapTc('map_ab4', [['a', 'aa'], ['b', 'bbb'], ['c', 'cake']], [['a', 'aa'], ['b', 'bbb'], ['c', 'bbb']]),
        mapTc('map_ab4', [['a', 'aa'], ['b', 'bbb']], [['a', 'aa'], ['b', 'bbb'], ['c', 'bbb']]),
        mapTc('map_ab4', [['a', 'aaa']], [['a', 'aaa']]),
        mapTc('map_ab4', [['a', 'aa'], ['b', 'bb'], ['c', 'cake']], [['a', ''], ['b', ''], ['c', 'cake']]),
        mapTc('map_ab4', [['b', 'bbb']], [['b', 'bbb']], true),
        mapTc('map_ab4', [['a', 'a'], ['b', 'b'], ['c', 'cake']], [['a', ''], ['b', ''], ['c', 'cake']], true),
        mapTc('map_ab4', [['a', ''], ['b', ''], ['c', 'cake']], [['a', ''], ['b', ''], ['c', 'cake']], true),
        mapTc('map_ab4', [['a', 'a'], ['b', ''], ['c', 'cake']], [['a', 'a'], ['b', ''], ['c', 'a']], true),
        mapTc('map_ab4', [['a', ''], ['b', 'b'], ['c', 'cake']], [['a', ''], ['b', 'b'], ['c', 'b']], true),
        mapTc('map_ab4', [['ab', 'ab'], ['c', 'cake']], [['ab', 'ab'], ['c', 'cake']], true),
        mapTc('map_ab4', [], [], true),
      ],
    },
  ],
};
