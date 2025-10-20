import { test } from "@playwright/test"

export class ChallengesService {

    constructor(request) {

        this.request = request
    }

    async get(token, testinfo) {
        return test.step('GET /challenges ', async () => {
            const response = await this.request.get(`${testinfo.project.use.apiURL}/challenges`,
                {
                  headers: { "x-challenger": token }
                })
            return (await response.json())
        })
    }
}