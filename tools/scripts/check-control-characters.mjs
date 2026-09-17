// Fails when a tracked text file contains ASCII control characters other than
// tab, line feed and carriage return. A single raw NUL byte makes Git treat a
// source file as binary, which hides its diffs from code review.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BINARY_EXTENSIONS = /\.(ico|png|jpe?g|gif|webp|woff2?|ttf|otf|pdf)$/i;
const FORBIDDEN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\x00')
  .filter((file) => file && !BINARY_EXTENSIONS.test(file));

const problems = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const match = FORBIDDEN.exec(line);
    if (match) {
      const code = match[0].charCodeAt(0).toString(16).padStart(2, '0');
      problems.push(`${file}:${index + 1}: control character 0x${code}`);
    }
  });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(
    'Write an escape sequence in the source instead of the raw character.',
  );
  process.exit(1);
}
console.log(`No control characters in ${files.length} tracked text files.`);
