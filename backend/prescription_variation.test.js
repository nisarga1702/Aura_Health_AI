const test = require('node:test');
const assert = require('node:assert/strict');

const { buildGeminiPrescriptionPrompt, extractGeminiResponseText } = require('./prescription_utils');

test('patient-specific values are embedded in the Gemini prompt', () => {
  const prompt = buildGeminiPrescriptionPrompt('Diabetes Mellitus', 82, {
    age: 67,
    bmi: 31,
    bloodSugar: 210,
    hba1c: 8.1,
    bp: '146/92',
    eGFR: 46,
    symptoms: ['frequentUrination', 'visionChanges']
  });

  assert.match(prompt, /Age: 67 years/);
  assert.match(prompt, /BMI: 31/);
  assert.match(prompt, /HbA1c: 8.1%/);
  assert.match(prompt, /eGFR: 46/);
  assert.match(prompt, /unique.*patient/i);
});

test('different patients produce different prescription prompts', () => {
  const promptA = buildGeminiPrescriptionPrompt('Diabetes Mellitus', 72, {
    age: 32,
    bmi: 21,
    bloodSugar: 96,
    hba1c: 5.6,
    bp: '118/76',
    eGFR: 99,
    symptoms: ['fatigue']
  });

  const promptB = buildGeminiPrescriptionPrompt('Diabetes Mellitus', 86, {
    age: 67,
    bmi: 31,
    bloodSugar: 210,
    hba1c: 8.1,
    bp: '146/92',
    eGFR: 46,
    symptoms: ['frequentUrination', 'visionChanges']
  });

  assert.notStrictEqual(promptA, promptB);
});

test('Gemini text extraction keeps content from all returned parts', () => {
  const text = extractGeminiResponseText({
    candidates: [{ content: { parts: [{ text: 'First sentence.' }, { text: 'Second sentence.' }] } }]
  });

  assert.equal(text, 'First sentence.\nSecond sentence.');
});
