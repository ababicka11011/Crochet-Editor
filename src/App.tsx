import { useMemo } from 'react'
import styles from './styles/App.module.css';
import type { Pattern } from './contracts/Pattern';
import { addStitch, increaseRound, startNewPattern } from './utils/pattern-operations'

function App() {
  // Create a sample pattern when the component mounts
  const pattern = useMemo(() => CreatePattern(), []);
  
  return (
    <div className={styles.App}>
      <header className={styles['App-header']}>
        <p>Crochet editor</p>
      </header>
      
        <div className={styles['App-body']}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 841.9 595.3">
            <g fill="#61DAFB">
              {Object.entries(pattern.layout.placements).map(([id, placement]) => (
                // Render each stitch as a circle for now with its type displayed in the center
                <g key={id}>
                  <circle cx={placement.x} cy={placement.y} r="5" fill="yellow" />
                  <text x={placement.x} y={placement.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={6} fill="black">{pattern.stitches[id].type}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>
    </div>
  );
}

function CreatePattern() {
  /*
  Function to create a sample crochet pattern. It starts with a chain stitch, adds 10 chain stitches, 
  moves to the next round, adds 10 single crochet stitches inserting into the previous chain stitches, 
  adds a chain stitch to transition to the next round, and finally adds 10 single crochet stitches 
  inserting into the previous single crochet stitches.
  Returns the final pattern object. 
  */
  let pattern: Pattern = startNewPattern("ch"); // Start with a chain stitch

  for (let i = 0; i < 10; i++) {
    pattern = ((r) => (r.ok ? r.value : pattern))(addStitch(pattern, 'ch')); // Add 10 chain stitches
  }

  pattern = ((r) => (r.ok ? r.value : pattern))(increaseRound(pattern)); // Move to the next round
  
  for (let i = 0; i < 10; i++) { // Add 10 single crochet stitches, inserting into the previous chain stitches
    pattern = ((r) => (r.ok ? r.value : pattern))(addStitch(pattern, 'sc', 'stitch-' + (9 - i)));
  }

  pattern = ((r) => (r.ok ? r.value : pattern))(addStitch(pattern, 'ch')); // Add a chain stitch to transition to the next round
  pattern = ((r) => (r.ok ? r.value : pattern))(increaseRound(pattern));
  
  for (let i = 0; i < 10; i++) { // Add 10 single crochet stitches, inserting into the previous single crochet stitches
    pattern = ((r) => (r.ok ? r.value : pattern))(addStitch(pattern, 'sc', 'stitch-' + (20 - i)));
  }

  return pattern;
}

export default App
