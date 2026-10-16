import assert from "node:assert/strict";
import test from "node:test";
import { initialJourney, startJourney, pauseJourney, advanceJourney } from "../app/recorrido/ride-journey.mjs";

test("each of the two legs lasts four seconds and waits at its destination", () => {
  let state = initialJourney();
  for (let stop = 1; stop <= 2; stop++) {
    state = startJourney(state, 3);
    state = advanceJourney(state, 3.99);
    assert.equal(state.phase, "riding");
    assert.equal(state.stop, stop - 1);
    state = advanceJourney(state, .011);
    assert.equal(state.phase, "arrived");
    assert.equal(state.stop, stop);
    assert.equal(state.progress, 1);
    assert.deepEqual(advanceJourney(state, 30), state);
  }
  assert.deepEqual(startJourney(state, 3), state);
});

test("pause preserves position and resume uses only the remaining travel time", () => {
  let state = advanceJourney(startJourney(initialJourney(), 3), 1.5);
  state = pauseJourney(state);
  assert.deepEqual(advanceJourney(state, 60), state);
  assert.equal(state.progress, .375);
  state = startJourney(state, 3);
  state = advanceJourney(state, 2.5);
  assert.equal(state.phase, "arrived");
  assert.equal(state.stop, 1);
});

test("a slow frame reaches its own stop without skipping the next image", () => {
  const state = advanceJourney(startJourney(initialJourney(), 3), 8);
  assert.equal(state.stop, 1);
  assert.equal(state.phase, "arrived");
  assert.equal(initialJourney().stop, 0);
  assert.deepEqual(startJourney(startJourney(initialJourney(), 3), 3), startJourney(initialJourney(), 3));
});
