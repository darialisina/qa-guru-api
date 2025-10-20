import { test as base } from "@playwright/test"
import { Api } from "../services/api.service"

export const test = base.extend({
  api: async ({ request }, use) => {
    let api = new Api(request)
    await use(api)
  }
})
