import {assert, test} from "vitest"
import {main} from "../src/main"

test("main", () => {
  const outputFileName = main('gen')
  assert.equal(outputFileName, "gen.onein.json")
})
