import { expect } from "@playwright/test"
import { test } from "../src/fixtures/index"

let token

test.describe("Challenge with service pattern", () => {
  test.beforeAll(async ({api}, testinfo) => {
    let r = await api.challenger.post(testinfo)
    const headers = r.headers()
    console.log(`${testinfo.project.use.apiURL}${headers.location}`)
    token = headers["x-challenger"]
  })


  test("First Real Challenge", async ({api}, testinfo) => {
    
    const body = await api.challenges.get(token, testinfo)
    expect(body.challenges.length).toBe(59)
  })
})