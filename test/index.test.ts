import {assert, test} from "vitest"
import {main} from "../src/main"

test("main", () => {
  const outputFileName = main('openapi.yaml', 'onein.yaml')
  assert.equal(outputFileName, "openapi.onein.json")
})
