import { loadAccuracySamples } from './accuracy-samples';
import { GestureRecognizer, type RecognitionResult } from '../src/content/recognizer';

async function main(): Promise<void> {
  const recognizer = new GestureRecognizer();
  const samples = loadAccuracySamples();
  const stats = {
    total: samples.length,
    correct: 0,
    byLabel: new Map<string, { total: number; correct: number }>(),
    misclassified: [] as { label: string; predicted: string; confidence: number }[],
  };

  for (const sample of samples) {
    const result: RecognitionResult = recognizer.recognize(sample.landmarks, sample.brightness);
    const matched = result.gesture === sample.label;

    stats.byLabel.set(sample.label, {
      total: (stats.byLabel.get(sample.label)?.total ?? 0) + 1,
      correct: (stats.byLabel.get(sample.label)?.correct ?? 0) + (matched ? 1 : 0),
    });

    if (matched) {
      stats.correct += 1;
    } else {
      stats.misclassified.push({
        label: sample.label,
        predicted: result.gesture,
        confidence: result.confidence,
      });
    }
  }

  console.log('\nGesture Recognition Accuracy Test');
  console.log('-----------------------------------');
  console.log(`Total samples: ${stats.total}`);
  console.log(`Correct: ${stats.correct}`);
  console.log(`Accuracy: ${(stats.correct / stats.total * 100).toFixed(1)}%\n`);

  for (const [label, { total, correct }] of stats.byLabel) {
    console.log(`${label.padEnd(5)}: ${correct}/${total} ${(correct / total * 100).toFixed(1)}%`);
  }

  if (stats.misclassified.length > 0) {
    console.log('\nSample misclassifications:');
    for (const item of stats.misclassified.slice(0, 10)) {
      console.log(`- expected ${item.label}, predicted ${item.predicted} (${item.confidence.toFixed(2)})`);
    }
  }
}

main().catch((err) => {
  console.error('Accuracy test failed:', err);
  process.exit(1);
});
