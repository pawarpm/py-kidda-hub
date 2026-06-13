import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db.js';
import { buildQuestionSeed } from './questions.js';

async function main() {
  const schema = await readFile(path.resolve('../db/schema.sql'), 'utf8');
  await query(schema);

  const studentHash = await bcrypt.hash('Student@123', 10);
  const adminHash = await bcrypt.hash('Admin@123', 10);
  await query(
    `INSERT INTO users (name, email, password_hash, college, role)
     VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10)
     ON CONFLICT (email) DO NOTHING`,
    ['Demo Student', 'student@example.com', studentHash, 'Demo Engineering College', 'student', 'Admin Faculty', 'admin@example.com', adminHash, 'Demo Engineering College', 'admin']
  );

  const existing = await query<{ count: string }>('SELECT count(*) FROM questions');
  if (Number(existing.rows[0].count) !== buildQuestionSeed().length) {
    await query('TRUNCATE questions CASCADE');
    for (const item of buildQuestionSeed()) {
      const inserted = await query<{ id: string }>(
        `INSERT INTO questions
        (title, slug, category, topic, difficulty, statement, constraints_text, sample_input, sample_output, starter_code, points)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id`,
        [item.title, item.slug, item.category, item.topic, item.difficulty, item.statement, item.constraints, item.sampleInput, item.sampleOutput, item.starterCode, item.points]
      );
      for (const testCase of item.cases) {
        await query('INSERT INTO test_cases (question_id, input_data, expected_output, is_hidden) VALUES ($1,$2,$3,$4)', [
          inserted.rows[0].id,
          testCase.input,
          testCase.output,
          testCase.hidden
        ]);
      }
    }
  }

  const mockTitles = [
    ['30-Minute Python Sprint', 30],
    ['60-Minute Practical Test', 60],
    ['90-Minute Placement Practice', 90],
    ['Full Semester Python Practice', 180]
  ] as const;
  for (const [title, minutes] of mockTitles) {
    await query('INSERT INTO mock_tests (title, duration_minutes) VALUES ($1,$2) ON CONFLICT DO NOTHING', [title, minutes]);
  }
  console.log(`Seed complete: ${buildQuestionSeed().length} syllabus questions, demo users, and mock tests are ready.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
