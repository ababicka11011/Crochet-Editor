import type { Pattern, Stitch, StitchType, StitchId, Insertion, Edge } from '../types/Stitch';
import type { Result } from '../types/Result';

export function startNewPattern(method: 'ch' | 'mr'): Pattern {
  /*
  Function to create a new crochet pattern. It initializes the pattern with a single stitch 
  of the specified method ('ch' for chain or 'mr' for magic ring).
  Returns the initial pattern object.
  */
  
  // Create the initial stitch with the specified method
  const initialStitch: Stitch = {
    id: 'stitch-0',
    type: method,
    layer: 0,
    previous: null,
    surroundingNodes: null,
    x: 700, // set starting position for the first stitch
    y: 320
  };

  // Return the initial pattern object with the first stitch and no edges
  return {
    stitches: { [initialStitch.id]: initialStitch },
    edges: [],
    cursor: initialStitch.id,
    currentRound: 0
  };
}

export function addStitch(pattern: Pattern, type: StitchType, 
    insertInto?: StitchId | StitchId[], insertion?: Insertion): Result<Pattern> {
  /*
  Function to add a new stitch to the crochet pattern. It takes the current pattern, the type of stitch to add, 
  and optionally the id(s) of the stitch(es) to insert into and the insertion method.
  Returns a Result object containing either the updated pattern or an error message.
  */

  // Walidacja wejścia. Sprawdź, czy wskazane id istnieją, czy typ oczka dopuszcza wbicie (isChain → brak insertInto) i czy nie powstaje cykl w krawędziach worked-into.
  // Wyliczenie pochodnych. Ustal nowe id, kolejne order, round (np. od oczka-rodzica + 1) i poprzednie oczko dla krawędzi sequence.
  // Budowa nowego stanu. Zwróć nowy obiekt: stitches z dodanym wpisem i edges z dopisanymi krawędziami. Nie modyfikuj p.
  // Zwrot wyniku. { ok: true, value } albo { ok: false, error }.
  // console.log('Adding stitch:', newStitchId, 'Type:', type, 'Insert into:', insertInto, 'Insertion:', insertion);
  
  // 1. Reject chain stitches that try to insert into something
  if (type === 'ch' && insertInto !== undefined) {
    return { ok: false, error: 'Chain stitches cannot be inserted into other stitches' };
  }

  // 2. Validate all insertion targets exist
  const targets = insertInto === undefined
    ? []
    : Array.isArray(insertInto) ? insertInto : [insertInto];

  for (const id of targets) {
    if (!pattern.stitches[id]) {
      return { ok: false, error: `Stitch ${id} does not exist` };
    }
  }

  // Choose the anchor stitch for positioning the new stitch. If insertInto is provided, use the first id in the array; otherwise, use the current cursor.
  const anchorId = Array.isArray(insertInto) ? insertInto[0] : insertInto;
  
  // Create the new stitch object with calculated properties based on the current pattern and provided parameters.
  const newStitch: Stitch = {
    id: `stitch-${Object.keys(pattern.stitches).length}`,
    type,
    layer: pattern.currentRound,
    previous: pattern.cursor,
    surroundingNodes: null, // add hole support later
    x: anchorId !== undefined ? pattern.stitches[anchorId]?.x
      : (pattern.stitches[pattern.cursor ?? '']?.x ?? 0) - 20 * (pattern.currentRound % 2 == 0 ? 1 : -1), // compute x based on insertInto and insertion if provided
    y: 320 - pattern.currentRound * 20,
  };

  // previousEdge is not needed since we already have previous in the stitch object, but we can keep it for calculating position.
  const previousEdge: Edge = { kind: 'previous', from: newStitch.id, to: pattern.cursor || '' };
  
  // Create the new pattern object by adding the new stitch and edge to the existing pattern.
  const newPattern: Pattern = { ...pattern, 
    stitches: { ...pattern.stitches, [newStitch.id]: newStitch }, 
    edges: [...pattern.edges, previousEdge], 
    cursor: newStitch.id
  };
  
  // If insertInto is provided, create insertion edges for each specified stitch id.
  if (insertInto) {
    if (Array.isArray(insertInto)) {
      insertInto.forEach(id => {
        const newEdge: Edge = { kind: 'insertion', from: newStitch.id, to: id, insertion };
        newPattern.edges.push(newEdge);
      });
    } else {
      const newEdge: Edge = { kind: 'insertion', from: newStitch.id, to: insertInto, insertion };
      newPattern.edges.push(newEdge);
    }
  }

  return { ok: true, value: newPattern };
}

export function removeLastStitch(pattern: Pattern): Result<Pattern> {
  /*
  Function to remove the last stitch from the crochet pattern. It checks if there are any stitches to remove, 
  identifies the previous stitch, and updates the pattern accordingly.
  Returns a Result object containing either the updated pattern or an error message.
  */
  // Check if there are any stitches to remove
  const stitchIds = Object.keys(pattern.stitches);
  if (stitchIds.length === 0) {
    return { ok: false, error: "No stitches to remove" };
  }

  // Identify the previous stitch based on the current cursor and edges
  const previousEdge = pattern.edges.find(
    edge => edge.kind === 'previous' && edge.from === pattern.cursor
  );
  const previousStitchId = previousEdge ? previousEdge.to : null;
  
  // Create a new stitches object without the last stitch and filter out edges related to the last stitch
  const newStitches = { ...pattern.stitches };
  delete newStitches[pattern.cursor!]; // remove the current (most recent) stitch
  const newEdges = pattern.edges.filter(edge => edge.from !== pattern.cursor && edge.to !== pattern.cursor);

  // Create the new pattern object with updated stitches, edges, and cursor
  const newPattern: Pattern = { ...pattern, stitches: newStitches, edges: newEdges, cursor: previousStitchId };

  return { ok: true, value: newPattern };
}

export function changeStitchType(pattern: Pattern, id: StitchId, newType: StitchType): Result<Pattern> {
  /*
  Function to change the type of a specific stitch in the crochet pattern. It checks if the stitch exists, 
  updates its type, and returns the updated pattern.
  Returns a Result object containing either the updated pattern or an error message.
  */
  // Check if the specified stitch exists in the pattern
  if (!pattern.stitches[id]) {
    return { ok: false, error: `Stitch with id ${id} does not exist` };
  }

  // Create a new stitch object with the updated type and construct the new pattern object with the modified stitches.
  const updatedStitch: Stitch = { ...pattern.stitches[id], type: newType };
  const newPattern: Pattern = { ...pattern, stitches: { ...pattern.stitches, [id]: updatedStitch } };

  return { ok: true, value: newPattern };
}

export function addSlipStitch(pattern: Pattern, target: StitchId, change_round: boolean = true): Result<Pattern> {
  /*
  Function to add a slip stitch to the crochet pattern. It checks if the target stitch exists, 
  creates a new edge representing the slip stitch, and updates the pattern accordingly.
  Options to change the round after adding the slip stitch can be specified.
  Returns a Result object containing either the updated pattern or an error message.
  */
  // Check if the current cursor exists and if the target stitch exists in the pattern
  if (!pattern.cursor) {
    return { ok: false, error: "No current stitch to slip stitch from" };
  }
  if (!pattern.stitches[target]) {
    return { ok: false, error: `Stitch with id ${target} does not exist` };
  }

  // Create a new edge representing the slip stitch and construct the new pattern object with the updated edges and cursor.
  const newEdge: Edge = { kind: 'slip-stitch', from: pattern.cursor || '', to: target };
  const newPattern: Pattern = { ...pattern, edges: [...pattern.edges, newEdge], cursor: target,
    currentRound: change_round ? pattern.currentRound + 1 : pattern.currentRound
  };
    
  return { ok: true, value: newPattern };
}

export function increaseRound(pattern: Pattern): Result<Pattern> {
  /*
  Function to increase the current round of the crochet pattern. It increments the currentRound property of the pattern.
  Returns a Result object containing either the updated pattern or an error message.
  */
  const newPattern: Pattern = { ...pattern, currentRound: pattern.currentRound + 1 };
  return { ok: true, value: newPattern };
}

// to be implemented: createSpace(pattern: Pattern, surrounding: StitchId[]): Result<{ pattern: Pattern; id: StitchId }>;
