import { readFileSync, writeFileSync } from 'fs';

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
const alreadyAdded = journal.entries.find(e => e.tag === 'curious_morlun');
if (alreadyAdded) {
  console.log('Already in journal');
} else {
  const lastIdx = journal.entries[journal.entries.length - 1]?.idx ?? -1;
  const newIdx = lastIdx + 1;
  journal.entries.push({ idx: newIdx, version: '6', when: Date.now(), tag: 'curious_morlun', breakpoints: true });
  writeFileSync('drizzle/meta/_journal.json', JSON.stringify(journal, null, 2));
  console.log('Journal updated, idx:', newIdx);
}
