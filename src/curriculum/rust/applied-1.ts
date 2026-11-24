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

export const applied1Section: SectionSpec = {
  id: 'applied-1',
  language: 'rust',
  title: 'Applied-1',
  description:
    'CS medium applied problems (Rust equivalent of AP-1) combining digit extraction, exam scoring, sorted slice merging, and monotonic checks.',
  difficultyRange: [250, 349],
  problems: [
    {
      id: 'rust-applied-1-scores-increasing',
      slug: 'scores_increasing',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'scores_increasing',
      difficulty: 255,
      doc: 'Given a slice of `scores` (length `>= 2`), return `true` if each score is equal to or greater than the one before (`scores[i] >= scores[i - 1]`).',
      functionName: 'scores_increasing',
      starterCode: `pub fn scores_increasing(scores: &[i32]) -> bool {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `scores.windows(2).all(|w| w[1] >= w[0])`!',
          snippet: 'scores.windows(2).all(|w| w[1] >= w[0])',
        },
        {
          text: 'Equal adjacent scores (`[1, 1, 4]`) still count as non-decreasing (`true`).',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn scores_increasing(scores: &[i32]) -> bool {\n    scores.windows(2).all(|w| w[1] >= w[0])\n}`,
      tests: [
        tc('scores_increasing(&[1, 3, 4])', 'true', 'scores_increasing(&[1, 3, 4])', 'true'),
        tc('scores_increasing(&[1, 3, 2])', 'false', 'scores_increasing(&[1, 3, 2])', 'false'),
        tc('scores_increasing(&[1, 1, 4])', 'true', 'scores_increasing(&[1, 1, 4])', 'true'),
        tc('scores_increasing(&[1, 1, 2, 4, 4, 7])', 'true', 'scores_increasing(&[1, 1, 2, 4, 4, 7])', 'true'),
        tc('scores_increasing(&[1, 1, 2, 4, 3, 7])', 'false', 'scores_increasing(&[1, 1, 2, 4, 3, 7])', 'false'),
        tc('scores_increasing(&[-5, 4, 11])', 'true', 'scores_increasing(&[-5, 4, 11])', 'true', true),
        tc('scores_increasing(&[5, 5])', 'true', 'scores_increasing(&[5, 5])', 'true', true),
        tc('scores_increasing(&[5, 4])', 'false', 'scores_increasing(&[5, 4])', 'false', true),
        tc('scores_increasing(&[-10, -5, 0, 5])', 'true', 'scores_increasing(&[-10, -5, 0, 5])', 'true', true),
        tc('scores_increasing(&[0, 0, -1])', 'false', 'scores_increasing(&[0, 0, -1])', 'false', true),
        tc('scores_increasing(&[10, 20, 30, 40])', 'true', 'scores_increasing(&[10, 20, 30, 40])', 'true', true),
        tc('scores_increasing(&[10, 20, 19, 40])', 'false', 'scores_increasing(&[10, 20, 19, 40])', 'false', true),
      ],
    },
    {
      id: 'rust-applied-1-scores-clump',
      slug: 'scores_clump',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'scores_clump',
      difficulty: 270,
      doc: 'Given a slice of `scores` sorted in increasing order, return `true` if the slice contains `3` adjacent scores that differ from each other by at most `2`, such as `[3, 4, 5]` or `[3, 5, 5]`.',
      functionName: 'scores_clump',
      starterCode: `pub fn scores_clump(scores: &[i32]) -> bool {\n    todo!()\n}`,
      hints: [
        {
          text: 'Because `scores` is sorted in non-decreasing order, three adjacent elements `w[0] <= w[1] <= w[2]` differ by at most `2` if and only if `w[2] - w[0] <= 2`!',
          snippet: 'scores.windows(3).any(|w| w[2] - w[0] <= 2)',
        },
        {
          text: 'Slices with fewer than `3` elements safely return `false`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn scores_clump(scores: &[i32]) -> bool {\n    scores.windows(3).any(|w| w[2] - w[0] <= 2)\n}`,
      tests: [
        tc('scores_clump(&[3, 4, 5])', 'true', 'scores_clump(&[3, 4, 5])', 'true'),
        tc('scores_clump(&[3, 4, 6])', 'false', 'scores_clump(&[3, 4, 6])', 'false'),
        tc('scores_clump(&[1, 3, 5, 5])', 'true', 'scores_clump(&[1, 3, 5, 5])', 'true'),
        tc('scores_clump(&[2, 4, 5, 6])', 'true', 'scores_clump(&[2, 4, 5, 6])', 'true'),
        tc('scores_clump(&[2, 4, 5, 7])', 'false', 'scores_clump(&[2, 4, 5, 7])', 'false'),
        tc('scores_clump(&[2, 4, 4, 7])', 'true', 'scores_clump(&[2, 4, 4, 7])', 'true', true),
        tc('scores_clump(&[3, 3, 6, 7, 9])', 'false', 'scores_clump(&[3, 3, 6, 7, 9])', 'false', true),
        tc('scores_clump(&[3, 3, 7, 7, 9])', 'true', 'scores_clump(&[3, 3, 7, 7, 9])', 'true', true),
        tc('scores_clump(&[4, 5, 8])', 'false', 'scores_clump(&[4, 5, 8])', 'false', true),
        tc('scores_clump(&[])', 'false', 'scores_clump(&[])', 'false', true),
        tc('scores_clump(&[1, 2])', 'false', 'scores_clump(&[1, 2])', 'false', true),
        tc('scores_clump(&[5, 5, 5])', 'true', 'scores_clump(&[5, 5, 5])', 'true', true),
      ],
    },
    {
      id: 'rust-applied-1-words-count',
      slug: 'words_count',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'words_count',
      difficulty: 285,
      doc: 'Given a slice of string slices `words` and an target length `len: usize`, return the count (`usize`) of strings that have exact character length `len`.',
      functionName: 'words_count',
      starterCode: `pub fn words_count(words: &[&str], len: usize) -> usize {\n    todo!()\n}`,
      hints: [
        {
          text: 'Filter `words` by `s.chars().count() == len` and call `.count()`.',
          snippet: 'words.iter().filter(|s| s.chars().count() == len).count()',
        },
        {
          text: 'Notice `.count()` returns `usize` directly.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn words_count(words: &[&str], len: usize) -> usize {\n    words.iter().filter(|s| s.chars().count() == len).count()\n}`,
      tests: [
        tc('words_count(&["a", "bb", "b", "ccc"], 1)', '2', 'words_count(&["a", "bb", "b", "ccc"], 1)', '2usize'),
        tc('words_count(&["a", "bb", "b", "ccc"], 3)', '1', 'words_count(&["a", "bb", "b", "ccc"], 3)', '1usize'),
        tc('words_count(&["a", "bb", "b", "ccc"], 4)', '0', 'words_count(&["a", "bb", "b", "ccc"], 4)', '0usize'),
        tc('words_count(&["xx", "yyy", "x", "yy", "z"], 1)', '2', 'words_count(&["xx", "yyy", "x", "yy", "z"], 1)', '2usize'),
        tc('words_count(&["xx", "yyy", "x", "yy", "z"], 2)', '2', 'words_count(&["xx", "yyy", "x", "yy", "z"], 2)', '2usize'),
        tc('words_count(&["xx", "yyy", "x", "yy", "z"], 3)', '1', 'words_count(&["xx", "yyy", "x", "yy", "z"], 3)', '1usize', true),
        tc('words_count(&[], 1)', '0', 'words_count(&[], 1)', '0usize', true),
        tc('words_count(&["", "a", ""], 0)', '2', 'words_count(&["", "a", ""], 0)', '2usize', true),
        tc('words_count(&["rust", "code", "hand"], 4)', '3', 'words_count(&["rust", "code", "hand"], 4)', '3usize', true),
        tc('words_count(&["rust", "code", "hand"], 5)', '0', 'words_count(&["rust", "code", "hand"], 5)', '0usize', true),
        tc('words_count(&["hi"], 2)', '1', 'words_count(&["hi"], 2)', '1usize', true),
        tc('words_count(&["a", "b", "c"], 1)', '3', 'words_count(&["a", "b", "c"], 1)', '3usize', true),
      ],
    },
    {
      id: 'rust-applied-1-has-one',
      slug: 'has_one',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'has_one',
      difficulty: 300,
      doc: 'Given a positive `i32` integer `n`, return `true` if it contains a `1` digit in base 10. Solve this arithmetically using `% 10` and `/ 10` without converting `n` to a `String`!',
      functionName: 'has_one',
      starterCode: `pub fn has_one(n: i32) -> bool {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use `let mut cur = n; while cur > 0 { ... }` to peel off the rightmost digit with `cur % 10`.',
          snippet: 'let mut cur = n;\nwhile cur > 0 {\n    if cur % 10 == 1 { return true; }\n    cur /= 10;\n}',
        },
        {
          text: 'If `cur` reaches `0` without seeing digit `1`, return `false`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn has_one(n: i32) -> bool {\n    let mut cur = n;\n    while cur > 0 {\n        if cur % 10 == 1 {\n            return true;\n        }\n        cur /= 10;\n    }\n    false\n}`,
      tests: [
        tc('has_one(10)', 'true', 'has_one(10)', 'true'),
        tc('has_one(22)', 'false', 'has_one(22)', 'false'),
        tc('has_one(220)', 'false', 'has_one(220)', 'false'),
        tc('has_one(212)', 'true', 'has_one(212)', 'true'),
        tc('has_one(1)', 'true', 'has_one(1)', 'true'),
        tc('has_one(9)', 'false', 'has_one(9)', 'false', true),
        tc('has_one(211112)', 'true', 'has_one(211112)', 'true', true),
        tc('has_one(121121)', 'true', 'has_one(121121)', 'true', true),
        tc('has_one(222222)', 'false', 'has_one(222222)', 'false', true),
        tc('has_one(56156)', 'true', 'has_one(56156)', 'true', true),
        tc('has_one(56556)', 'false', 'has_one(56556)', 'false', true),
        tc('has_one(100000)', 'true', 'has_one(100000)', 'true', true),
      ],
    },
    {
      id: 'rust-applied-1-divides-self',
      slug: 'divides_self',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'divides_self',
      difficulty: 315,
      doc: 'We say that a positive `i32` integer divides itself if every digit in the number divides into the number evenly (`n % digit == 0`). So for example `128` divides itself since `1`, `2`, and `8` all divide into `128` evenly. No number with a `0` digit divides itself. Return `true` if `n` divides itself.',
      functionName: 'divides_self',
      starterCode: `pub fn divides_self(n: i32) -> bool {\n    todo!()\n}`,
      hints: [
        {
          text: 'Keep `n` intact while dividing a separate `let mut cur = n;` by `10` on each iteration.',
          snippet: 'let d = cur % 10;\nif d == 0 || n % d != 0 {\n    return false;\n}',
        },
        {
          text: 'Always check `d == 0` BEFORE `n % d` so you never divide by zero!',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn divides_self(n: i32) -> bool {\n    let mut cur = n;\n    while cur > 0 {\n        let d = cur % 10;\n        if d == 0 || n % d != 0 {\n            return false;\n        }\n        cur /= 10;\n    }\n    true\n}`,
      tests: [
        tc('divides_self(128)', 'true', 'divides_self(128)', 'true'),
        tc('divides_self(12)', 'true', 'divides_self(12)', 'true'),
        tc('divides_self(120)', 'false', 'divides_self(120)', 'false'),
        tc('divides_self(122)', 'true', 'divides_self(122)', 'true'),
        tc('divides_self(13)', 'false', 'divides_self(13)', 'false'),
        tc('divides_self(32)', 'false', 'divides_self(32)', 'false', true),
        tc('divides_self(22)', 'true', 'divides_self(22)', 'true', true),
        tc('divides_self(42)', 'false', 'divides_self(42)', 'false', true),
        tc('divides_self(212)', 'true', 'divides_self(212)', 'true', true),
        tc('divides_self(213)', 'false', 'divides_self(213)', 'false', true),
        tc('divides_self(162)', 'true', 'divides_self(162)', 'true', true),
        tc('divides_self(7)', 'true', 'divides_self(7)', 'true', true),
      ],
    },
    {
      id: 'rust-applied-1-score-up',
      slug: 'score_up',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'score_up',
      difficulty: 330,
      doc: 'The `key` slice contains the correct answers to an exam, like `&["a", "a", "b", "b"]`. The `answers` slice (same length) contains a student\'s answers, with `"?"` representing a question left blank. A correct answer is worth `+4`, an incorrect answer is worth `-1`, and `"?"` is worth `0`. Return the student\'s total score.',
      functionName: 'score_up',
      starterCode: `pub fn score_up(key: &[&str], answers: &[&str]) -> i32 {\n    todo!()\n}`,
      hints: [
        {
          text: 'Pair corresponding answers using `key.iter().zip(answers.iter())`!',
          snippet: 'for (&k, &a) in key.iter().zip(answers.iter()) {\n    if a == "?" { continue; }\n    score += if a == k { 4 } else { -1 };\n}',
        },
        {
          text: 'Check `a == "?"` before comparing `a == k`.',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn score_up(key: &[&str], answers: &[&str]) -> i32 {\n    let mut score = 0;\n    for (&k, &a) in key.iter().zip(answers.iter()) {\n        if a == "?" {\n            continue;\n        } else if a == k {\n            score += 4;\n        } else {\n            score -= 1;\n        }\n    }\n    score\n}`,
      tests: [
        tc('score_up(&["a", "a", "b", "b"], &["a", "c", "b", "c"])', '6', 'score_up(&["a", "a", "b", "b"], &["a", "c", "b", "c"])', '6'),
        tc('score_up(&["a", "a", "b", "b"], &["a", "a", "b", "c"])', '11', 'score_up(&["a", "a", "b", "b"], &["a", "a", "b", "c"])', '11'),
        tc('score_up(&["a", "a", "b", "b"], &["a", "a", "b", "b"])', '16', 'score_up(&["a", "a", "b", "b"], &["a", "a", "b", "b"])', '16'),
        tc('score_up(&["a", "a", "b", "b"], &["?", "c", "b", "?"])', '3', 'score_up(&["a", "a", "b", "b"], &["?", "c", "b", "?"])', '3'),
        tc('score_up(&["a", "a", "b", "b"], &["?", "c", "?", "?"])', '-1', 'score_up(&["a", "a", "b", "b"], &["?", "c", "?", "?"])', '-1'),
        tc('score_up(&["a", "a", "b", "b"], &["c", "?", "b", "b"])', '7', 'score_up(&["a", "a", "b", "b"], &["c", "?", "b", "b"])', '7', true),
        tc('score_up(&["a", "a", "b", "b"], &["c", "?", "b", "?"])', '3', 'score_up(&["a", "a", "b", "b"], &["c", "?", "b", "?"])', '3', true),
        tc('score_up(&["a", "b", "c"], &["a", "c", "b"])', '2', 'score_up(&["a", "b", "c"], &["a", "c", "b"])', '2', true),
        tc('score_up(&["a", "a", "b", "b", "c", "c"], &["a", "c", "a", "c", "a", "c"])', '4', 'score_up(&["a", "a", "b", "b", "c", "c"], &["a", "c", "a", "c", "a", "c"])', '4', true),
        tc('score_up(&["a", "a", "b", "b", "c", "c"], &["a", "c", "?", "?", "a", "c"])', '6', 'score_up(&["a", "a", "b", "b", "c", "c"], &["a", "c", "?", "?", "a", "c"])', '6', true),
        tc('score_up(&["a", "b"], &["?", "?"])', '0', 'score_up(&["a", "b"], &["?", "?"])', '0', true),
        tc('score_up(&["a", "b"], &["b", "a"])', '-2', 'score_up(&["a", "b"], &["b", "a"])', '-2', true),
      ],
    },
    {
      id: 'rust-applied-1-merge-two',
      slug: 'merge_two',
      language: 'rust',
      sectionId: 'applied-1',
      title: 'merge_two',
      difficulty: 345,
      doc: 'Start with two slices of strings, `a` and `b`, each sorted in alphabetical order and without duplicates inside itself. Return a `Vec<String>` containing the first `n` unique elements from the two slices combined in alphabetical order (guaranteed at least `n` unique elements exist across `a` and `b`).',
      functionName: 'merge_two',
      starterCode: `pub fn merge_two(a: &[&str], b: &[&str], n: usize) -> Vec<String> {\n    todo!()\n}`,
      hints: [
        {
          text: 'Use two indices `i` and `j` while `out.len() < n`, comparing `a.get(i)` and `b.get(j)` using `std::cmp::Ordering`.',
          snippet: 'match a[i].cmp(b[j]) {\n    Ordering::Less => { out.push(a[i].to_string()); i += 1; }\n    Ordering::Greater => { out.push(b[j].to_string()); j += 1; }\n    Ordering::Equal => { out.push(a[i].to_string()); i += 1; j += 1; }\n}',
        },
        {
          text: 'Advancing BOTH `i` and `j` when `a[i] == b[j]` skips duplicates in O(n) time!',
        },
      ],
      showsolution: false,
      showpost: true,
      solution: `pub fn merge_two(a: &[&str], b: &[&str], n: usize) -> Vec<String> {\n    use std::cmp::Ordering;\n    let mut out = Vec::with_capacity(n);\n    let mut i = 0;\n    let mut j = 0;\n    while out.len() < n {\n        match (a.get(i), b.get(j)) {\n            (Some(&sa), Some(&sb)) => match sa.cmp(sb) {\n                Ordering::Less => {\n                    out.push(sa.to_string());\n                    i += 1;\n                }\n                Ordering::Greater => {\n                    out.push(sb.to_string());\n                    j += 1;\n                }\n                Ordering::Equal => {\n                    out.push(sa.to_string());\n                    i += 1;\n                    j += 1;\n                }\n            },\n            (Some(&sa), None) => {\n                out.push(sa.to_string());\n                i += 1;\n            }\n            (None, Some(&sb)) => {\n                out.push(sb.to_string());\n                j += 1;\n            }\n            (None, None) => break,\n        }\n    }\n    out\n}`,
      tests: [
        tc('merge_two(&["a", "c", "z"], &["b", "f", "z"], 3)', dispVecStr(['a', 'b', 'c']), 'merge_two(&["a", "c", "z"], &["b", "f", "z"], 3)', rsVecStr(['a', 'b', 'c'])),
        tc('merge_two(&["a", "c", "z"], &["c", "f", "z"], 3)', dispVecStr(['a', 'c', 'f']), 'merge_two(&["a", "c", "z"], &["c", "f", "z"], 3)', rsVecStr(['a', 'c', 'f'])),
        tc('merge_two(&["f", "g", "z"], &["c", "f", "g"], 3)', dispVecStr(['c', 'f', 'g']), 'merge_two(&["f", "g", "z"], &["c", "f", "g"], 3)', rsVecStr(['c', 'f', 'g'])),
        tc('merge_two(&["a", "c", "z"], &["a", "c", "z"], 3)', dispVecStr(['a', 'c', 'z']), 'merge_two(&["a", "c", "z"], &["a", "c", "z"], 3)', rsVecStr(['a', 'c', 'z'])),
        tc('merge_two(&["a", "b", "c", "z"], &["a", "c", "z"], 3)', dispVecStr(['a', 'b', 'c']), 'merge_two(&["a", "b", "c", "z"], &["a", "c", "z"], 3)', rsVecStr(['a', 'b', 'c'])),
        tc('merge_two(&["a", "c", "z"], &["a", "b", "c", "z"], 3)', dispVecStr(['a', 'b', 'c']), 'merge_two(&["a", "c", "z"], &["a", "b", "c", "z"], 3)', rsVecStr(['a', 'b', 'c']), true),
        tc('merge_two(&["a", "c", "z"], &["a", "c", "z"], 2)', dispVecStr(['a', 'c']), 'merge_two(&["a", "c", "z"], &["a", "c", "z"], 2)', rsVecStr(['a', 'c']), true),
        tc('merge_two(&["a", "c", "z"], &["a", "c", "y", "z"], 3)', dispVecStr(['a', 'c', 'y']), 'merge_two(&["a", "c", "z"], &["a", "c", "y", "z"], 3)', rsVecStr(['a', 'c', 'y']), true),
        tc('merge_two(&["x", "y", "z"], &["a", "b", "z"], 3)', dispVecStr(['a', 'b', 'x']), 'merge_two(&["x", "y", "z"], &["a", "b", "z"], 3)', rsVecStr(['a', 'b', 'x']), true),
        tc('merge_two(&[], &["a", "b", "c"], 2)', dispVecStr(['a', 'b']), 'merge_two(&[], &["a", "b", "c"], 2)', rsVecStr(['a', 'b']), true),
        tc('merge_two(&["a", "b", "c"], &[], 2)', dispVecStr(['a', 'b']), 'merge_two(&["a", "b", "c"], &[], 2)', rsVecStr(['a', 'b']), true),
        tc('merge_two(&["a", "b"], &["c", "d"], 0)', '[]', 'merge_two(&["a", "b"], &["c", "d"], 0)', rsVecStr([]), true),
      ],
    },
  ],
};
