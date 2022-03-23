import {assert, test} from "vitest"
import {main} from "../src/main"

test("main", () => {
  const outputFileName = main('openapi.yaml', 'wanying.yaml')
  assert.equal(outputFileName, "openapi.wanying.json")
})
