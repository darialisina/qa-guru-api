import { test, expect } from "@playwright/test"

let token
const crypto = require("crypto")

test.describe("Challenge", () => {
  test.beforeAll(async ({ request }, testinfo) => {
    const r = await request.post(`${testinfo.project.use.apiURL}/challenger`)
    const headers = r.headers()
    console.log(`${testinfo.project.use.apiURL}/${headers.location}`)
    token = headers["x-challenger"]
  })


  test("First Real Challenge @api @positive", async ({ request }, testinfo) => {

    let resp = await request.get(`${testinfo.project.use.apiURL}/challenges`,
      {
        headers: { "x-challenger": token }
      }
    )

    const body = await resp.json()
    expect(resp.status()).toBe(200)
    expect(body.challenges.length).toBe(59)
  })


   // GET Challenges
   test("GET /todos (200) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body).toHaveProperty("todos")
  })

  test("GET /todo (404) not plural @api @negative", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todo`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(404)
  })

  test("GET /todos/{id} (200) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos/1`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.todos[0]).toHaveProperty("id")
    expect(body.todos[0].id).toBe(1)
    expect(body.todos[0]).toHaveProperty("title")
    expect(body.todos[0]).toHaveProperty("doneStatus")
  })

  test("GET /todos/{id} (404) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos/99999`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(404)
    const body = await resp.json()
    expect(body.errorMessages[0]).toEqual("Could not find an instance with todos/99999")
  })

  test("GET /todos (200) ?filter @api @positive", async ({ request }, testinfo) => {
    // Создаем задачу со статусом DONE
    let resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: "Done task", doneStatus: true }
    })
    const taskID = (await resp.json()).id

    // Проверяем, что в списке выполненных задач есть созданная
    resp = await request.get(`${testinfo.project.use.apiURL}/todos?doneStatus=true`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.todos.length).toBeGreaterThan(0)
    let isTaskInList = false
    body.todos.forEach(todo => {
      expect(todo.doneStatus).toBe(true)
      if (todo.id == taskID){
        isTaskInList = true
      }
    })
    expect(isTaskInList).toBeTruthy()
  })

  // HEAD Challenge
  test("HEAD /todos (200) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.head(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(200)
    expect(resp.headers().server).toEqual("Heroku")
  })

  // Creation Challenges with POST
  test("POST /todos (201) @api @positive", async ({ request }, testinfo) => {
    const todoData = {
      title: "Помыть посуду",
      doneStatus: false,
      description: "Сделай это раньше, чем приедет мама!"
    }

    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: todoData
    })

    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.title).toBe(todoData.title)
    expect(body.doneStatus).toBe(todoData.doneStatus)
    expect(body.description).toBe(todoData.description)
  })

  test("POST /todos (400) doneStatus @api @negative", async ({ request }, testinfo) => {
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: "Сдать анализы", doneStatus: "not done" }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages[0]).toEqual('Failed Validation: doneStatus should be BOOLEAN but was STRING')
  })

  test("POST /todos (400) title too long @api @negative", async ({ request }, testinfo) => {
    const longTitle = "Погулять, поспать, поесть, вынести мусор, купить землю для цветов, записаться на стрижку"
    
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: longTitle, doneStatus: false }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages).toContain("Failed Validation: Maximum allowable length exceeded for title - maximum allowed is 50")
  })

  test("POST /todos (400) description too long @api @negative", async ({ request }, testinfo) => {
    const longDescription = "Погулять, поспать, поесть, вынести мусор, купить землю для цветов, записаться на стрижку".repeat(3)
    
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: "Все мои дела", doneStatus: false, description: longDescription }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages).toContain("Failed Validation: Maximum allowable length exceeded for description - maximum allowed is 200")
  })

  test("POST /todos (201) max out content @api @positive", async ({ request }, testinfo) => {
    const maxTitle = "a".repeat(50)
    const maxDescription = "b".repeat(200)
    
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: maxTitle, doneStatus: false, description: maxDescription }
    })

    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.title.length).toBe(50)
    expect(body.description.length).toBe(200)
    expect(body.title).toEqual(maxTitle)
    expect(body.description).toEqual(maxDescription)
  })

  test("POST /todos (413) content too long @api @negative", async ({ request }, testinfo) => {
    const title = "a".repeat(5)
    const description = "b".repeat(5001)
    
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: title, doneStatus: false, description: description }
    })

    expect(resp.status()).toBe(413)
    const body = await resp.json()
    expect(body.errorMessages).toContain('Error: Request body too large, max allowed is 5000 bytes')
  })

  test("POST /todos (400) extra field @api @negative", async ({ request }, testinfo) => {
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: "Test", doneStatus: false, extraField: "not allowed" }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages).toContain("Could not find field: extraField")
  })

  // Creation Challenges with PUT
  test("PUT /todos/{id} (400) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.put(`${testinfo.project.use.apiURL}/todos/99999`, {
      headers: { "x-challenger": token },
      data: { title: "Еще задача", doneStatus: false }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages).toContain('Cannot create todo with PUT due to Auto fields id')
    
  })

  // Update Challenges with POST
  test("POST /todos/{id} (200) @api @positive", async ({ request }, testinfo) => {
    const newTitle = 'Изменившееся название'
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos/1`, {
      headers: { "x-challenger": token },
      data: { title: newTitle }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.title).toEqual(newTitle)
    expect(body.id).toEqual(1)
  })

  test("POST /todos/{id} (404) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos/99999`, {
      headers: { "x-challenger": token },
      data: { title: "НОВОЕ" }
    })

    expect(resp.status()).toBe(404)
    const body = await resp.json()
    expect(body.errorMessages).toContain('No such todo entity instance with id == 99999 found')
  })

  // Update Challenges with PUT
  test("PUT /todos/{id} full (200) @api @positive", async ({ request }, testinfo) => {
    const updateData = {
      id: 1,
      title: "Выгулять собаку",
      doneStatus: true,
      description: "Все прошло успешно!"
    }

    const resp = await request.put(`${testinfo.project.use.apiURL}/todos/1`, {
      headers: { "x-challenger": token },
      data: updateData
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.title).toBe(updateData.title)
    expect(body.doneStatus).toBe(updateData.doneStatus)
    expect(body.description).toBe(updateData.description)
  })

  test("PUT /todos/{id} partial (200) @api @positive", async ({ request }, testinfo) => {
    const updateData = {
      id: 2,
      title: "Полить цветы"
    }

    const resp = await request.put(`${testinfo.project.use.apiURL}/todos/2`, {
      headers: { "x-challenger": token },
      data: updateData
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.title).toBe(updateData.title)
  })

  test("PUT /todos/{id} no title (400) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.put(`${testinfo.project.use.apiURL}/todos/1`, {
      headers: { "x-challenger": token },
      data: { id: 1, doneStatus: true }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages).toContain("title : field is mandatory")
  })

  test("PUT /todos/{id} no amend id (400) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.put(`${testinfo.project.use.apiURL}/todos/1`, {
      headers: { "x-challenger": token },
      data: { id: 2, title:'Новое название', doneStatus: true }
    })

    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body.errorMessages).toContain("Can not amend id from 1 to 2")
  })

  // DELETE Challenge
  test("DELETE /todos/{id} (200) @api @positive", async ({ request }, testinfo) => {
    // Создаем задачу для удаления
    let resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: { title: "To delete", doneStatus: false }
    })
    const taskID = (await resp.json()).id

    resp = await request.delete(`${testinfo.project.use.apiURL}/todos/${taskID}`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(200)

    // Проверяем, что todo действительно удалено
    const checkResp = await request.get(`${testinfo.project.use.apiURL}/todos/${taskID}`, {
      headers: { "x-challenger": token }
    })
    expect(checkResp.status()).toBe(404)
  })

  // OPTIONS Challenge
  test("OPTIONS /todos (200) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.fetch(`${testinfo.project.use.apiURL}/todos`, {
      method: "OPTIONS",
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(200)
    const allowHeader = resp.headers()["allow"]
    expect(allowHeader).toContain("OPTIONS")
    expect(allowHeader).toContain("GET")
    expect(allowHeader).toContain("HEAD")
    expect(allowHeader).toContain("POST")
  })

  // Accept Challenges
  test("GET /todos (200) XML @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Accept": "application/xml"
      }
    })

    expect(resp.status()).toBe(200)
    expect(resp.headers()["content-type"]).toContain("application/xml")
    const body = await resp.text()
    expect(body).toContain("<todos>")
  })

  test("GET /todos (200) JSON @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Accept": "application/json"
      }
    })

    expect(resp.status()).toBe(200)
    expect(resp.headers()["content-type"]).toContain("application/json")
    const body = await resp.json()
    expect(body).toHaveProperty("todos")
  })

  test("GET /todos (200) ANY @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Accept": "*/*"
      }
    })

    expect(resp.status()).toBe(200)
    expect(resp.headers()["content-type"]).toContain("application/json")
    const body = await resp.json()
    expect(body).toHaveProperty("todos")
  })

  test("GET /todos (200) XML pref @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Accept": "application/xml, application/json"
      }
    })

    expect(resp.status()).toBe(200)
    expect(resp.headers()["content-type"]).toContain("application/xml")
    const body = await resp.text()
    expect(body).toContain("<todos>")
  })

  test("GET /todos (200) no accept @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Accept": ""
      }
    })

    expect(resp.status()).toBe(200)
    expect(resp.headers()["content-type"]).toContain("application/json")
    const body = await resp.json()
    expect(body).toHaveProperty("todos")
  })

  test("GET /todos (406) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Accept": "application/gzip"
      }
    })

    expect(resp.status()).toBe(406)
    const body = await resp.json()
    expect(body.errorMessages).toContain('Unrecognised Accept Type')
  })

  // Content-Type Challenges
  test("POST /todos XML @api @positive", async ({ request }, testinfo) => {
    const taskXML = '<todo><doneStatus>false</doneStatus><description/><title>scan paperwork</title></todo>'
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Content-Type": "application/xml",
        "Accept": "application/xml"
      },
      data: taskXML
    })

    expect(resp.status()).toBe(201)
    expect(resp.headers()["content-type"]).toContain("application/xml")
    const body = await resp.text()
    expect(body).toContain('<title>scan paperwork</title>')
  })

  test("POST /todos JSON @api @positive", async ({ request }, testinfo) => {
    const taskJSON = { title: "Теперь JSON", doneStatus: false }
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      data: taskJSON
    })

    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.title).toBe(taskJSON.title)
  })

  test("POST /todos (415) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Content-Type": "application/gzip"
      },
      data: { title: "Архив", doneStatus: false }
    })

    expect(resp.status()).toBe(415)
    const body = await resp.json()
    expect(body.errorMessages).toContain('Unsupported Content Type - application/gzip')
  })

  // Restore session
  test("GET /challenger/guid (existing X-CHALLENGER) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
      headers: { 
        "x-challenger": token,
      }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.xChallenger).toEqual(token)
  })

  test("PUT /challenger/guid RESTORE @api @positive", async ({ request }, testinfo) => {
    let resp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
      headers: { 
        "x-challenger": token,
      }
    })
    const payload = await resp.json()
    payload['secretNote'] = 'Изменения имеются'

    resp = await request.put(`${testinfo.project.use.apiURL}/challenger/${token}`, {
      data: payload
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.xChallenger).toEqual(token)
    expect(body.secretNote).toEqual(payload['secretNote'])
  })

  test("PUT /challenger/guid CREATE @api @positive", async ({ request }, testinfo) => {
    // Генерируем новый GUID
    const newGuid = crypto.randomUUID()
    const templateResp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
      headers: { "x-challenger": token }
    })
    
    expect(templateResp.status()).toBe(200)
    const templateData = await templateResp.json()
    
    // Заменяем на новый GUID
    const newChallengerData = {
      ...templateData,
      xChallenger: newGuid
    }
    
    const createResp = await request.put(`${testinfo.project.use.apiURL}/challenger/${newGuid}`, {
      headers: { 
        "x-challenger": newGuid,
        "Content-Type": "application/json"
      },
      data: newChallengerData
    })
    expect(createResp.status()).toBe(201)
    expect(createResp.headers()["x-challenger"]).toBe(newGuid)
  })
  
  

  test("GET /challenger/database/guid (200) @api @positive", async ({ request }, testinfo) => {
    let resp = await request.get(`${testinfo.project.use.apiURL}/challenger/database/${token}`, {
      headers: { 
        "x-challenger": token,
      }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body).toHaveProperty('todos')
  })

  test("PUT /challenger/database/guid (Update) @api @positive", async ({ request }, testinfo) => {
    let resp = await request.get(`${testinfo.project.use.apiURL}/challenger/database/${token}`, {
      headers: { 
        "x-challenger": token,
      }
    })
  
    expect(resp.status()).toBe(200)
    let payload = await resp.json()
    
    const originalTitle = payload.todos[0].title
    const newTitle = 'Измененное значение'
    payload.todos[0].title = newTitle
  
    resp = await request.put(`${testinfo.project.use.apiURL}/challenger/database/${token}`, {
      headers: { 
        "x-challenger": token,
        "Content-Type": "application/json"
      },
      data: payload
    })
    expect(resp.status()).toBe(204)
  })
  
  // Mix Accept and Content-Type Challenges
  test("POST /todos XML to JSON @api @positive", async ({ request }, testinfo) => {
    const taskXML = '<todo><doneStatus>false</doneStatus><description/><title>scan paperwork</title></todo>'
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Content-Type": "application/xml",
        "Accept": "application/json"
      },
      data: taskXML
    })

    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.title).toBe('scan paperwork')
  })

  test("POST /todos JSON to XML @api @positive", async ({ request }, testinfo) => {
    const taskJSON = { title: "Теперь JSON", doneStatus: false }
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { 
        "x-challenger": token,
        "Content-Type": "application/json",
        "Accept": "application/xml"
      },
      data: taskJSON
    })

    expect(resp.status()).toBe(201)
    expect(resp.headers()["content-type"]).toContain("application/xml")
    const body = await resp.text()
    expect(body).toContain('<title>Теперь JSON</title>')
  })

  // Status Code Challenges
  test("DELETE /heartbeat (405) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.delete(`${testinfo.project.use.apiURL}/heartbeat`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(405)
  })

  test("GET /heartbeat (204) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/heartbeat`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(204)
  })

  test("PATCH /heartbeat (500) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.patch(`${testinfo.project.use.apiURL}/heartbeat`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(500)
  })

  test("TRACE /heartbeat (501) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.fetch(`${testinfo.project.use.apiURL}/heartbeat`, {
      method: "TRACE",
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(501)
  })

  // Authentication Challenges
  test("POST /secret/token (401) @api @auth @api @negative", async ({ request }, testinfo) => {
    const resp = await request.post(`${testinfo.project.use.apiURL}/secret/token`, {
      headers: { 
        "x-challenger": token,
        "Authorization": "Random string"
      }
    })

    expect(resp.status()).toBe(401)
  })

  test("POST /secret/token (201) @api @positive", async ({ request }, testinfo) => {
    const resp = await request.post(`${testinfo.project.use.apiURL}/secret/token`, {
      headers: { 
        "x-challenger": token,
        "Authorization": "Basic " + Buffer.from("admin:password").toString("base64")
      }
    })

    expect(resp.status()).toBe(201)
  })

  // Authorization Challenges
  test("GET /secret/note (401) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/secret/note`, {
      headers: { "x-challenger": token }
    })

    expect(resp.status()).toBe(401)
  })

  test("GET /secret/note (403) @api @negative", async ({ request }, testinfo) => {
    const resp = await request.get(`${testinfo.project.use.apiURL}/secret/note`, {
      headers: { 
        "x-challenger": token,
        "X-AUTH-TOKEN": "invalid-token"
      }
    })

    expect(resp.status()).toBe(403)
  })

  test("GET /secret/note (200) @api @positive", async ({ request }, testinfo) => {
    // Получаем токен сначала
    let  resp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
      headers: { 
        "x-challenger": token,
      }
    })

    let authToken = (await resp.json()).xAuthToken

     resp = await request.get(`${testinfo.project.use.apiURL}/secret/note`, {
      headers: { 
        "x-challenger": token,
        "X-AUTH-TOKEN": authToken
      }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body).toHaveProperty("note")
  })

  test("POST /secret/note (200) @api @positive", async ({ request }, testinfo) => {
    // Получаем токен сначала
    let  resp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
      headers: { 
        "x-challenger": token,
      }
    })

    let authToken = (await resp.json()).xAuthToken

    const noteText = "My secret note for testing"
    resp = await request.post(`${testinfo.project.use.apiURL}/secret/note`, {
      headers: { 
        "x-challenger": token,
        "X-AUTH-TOKEN": authToken
      },
      data: { note: noteText }
    })

    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.note).toBe(noteText)
  })

  // HTTP Method Override Challenges
test("POST /heartbeat as DELETE (405) @api @negative", async ({ request }, testinfo) => {
  const resp = await request.post(`${testinfo.project.use.apiURL}/heartbeat`, {
    headers: { 
      "x-challenger": token,
      "X-HTTP-Method-Override": "DELETE"
    }
  })

  expect(resp.status()).toBe(405)
})

test("POST /heartbeat as PATCH (500) @api @negative", async ({ request }, testinfo) => {
  const resp = await request.post(`${testinfo.project.use.apiURL}/heartbeat`, {
    headers: { 
      "x-challenger": token,
      "X-HTTP-Method-Override": "PATCH"
    }
  })

  expect(resp.status()).toBe(500)
  expect(resp.statusText()).toContain("Internal Server Error")
})

test("POST /heartbeat as TRACE (501) @api @negative", async ({ request }, testinfo) => {
  const resp = await request.post(`${testinfo.project.use.apiURL}/heartbeat`, {
    headers: { 
      "x-challenger": token,
      "X-HTTP-Method-Override": "TRACE"
    }
  })

  expect(resp.status()).toBe(501)
  expect(resp.statusText()).toContain("Not Implemented")
})


// Authorization Challenges - POST
test("POST /secret/note (401) no token @api @negative", async ({ request }, testinfo) => {
  const resp = await request.post(`${testinfo.project.use.apiURL}/secret/note`, {
    headers: { 
      "x-challenger": token
    },
    data: { note: "test note" }
  })

  expect(resp.status()).toBe(401)
})

test("POST /secret/note (403) invalid token @api @negative", async ({ request }, testinfo) => {
  const resp = await request.post(`${testinfo.project.use.apiURL}/secret/note`, {
    headers: { 
      "x-challenger": token,
      "X-AUTH-TOKEN": "invalid-fake-token-12345"
    },
    data: { note: "test note" }
  })

  expect(resp.status()).toBe(403)
})

test("GET /secret/note (Bearer) @api @positive", async ({ request }, testinfo) => {
  // Получаем токен сначала
  let  resp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
    headers: { 
      "x-challenger": token,
    }
  })

  let authToken = (await resp.json()).xAuthToken

  // Используем Bearer token в Authorization заголовке
   resp = await request.get(`${testinfo.project.use.apiURL}/secret/note`, {
    headers: { 
      "x-challenger": token,
      "Authorization": `Bearer ${authToken}`
    }
  })

  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body).toHaveProperty("note")
  expect(typeof body.note).toBe("string")
})

test("POST /secret/note (Bearer) @api @positive", async ({ request }, testinfo) => {
  // Получаем токен сначала
  let  resp = await request.get(`${testinfo.project.use.apiURL}/challenger/${token}`, {
    headers: { 
      "x-challenger": token,
    }
  })

  let authToken = (await resp.json()).xAuthToken
  const noteText = "Bearer token test note"
 resp = await request.post(`${testinfo.project.use.apiURL}/secret/note`, {
    headers: { 
      "x-challenger": token,
      "Authorization": `Bearer ${authToken}`
    },
    data: { note: noteText }
  })

  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.note).toBe(noteText)
  
  // Проверяем, что заметка действительно сохранилась
  const verifyResp = await request.get(`${testinfo.project.use.apiURL}/secret/note`, {
    headers: { 
      "x-challenger": token,
      "Authorization": `Bearer ${authToken}`
    }
  })
  
  const verifyBody = await verifyResp.json()
  expect(verifyBody.note).toBe(noteText)
})

// Miscellaneous Challenges
test("DELETE /todos/{id} (200) all @api @positive", async ({ request }, testinfo) => {
  // Получаем все todos
  let resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
    headers: { "x-challenger": token }
  })
  
  let todosBody = await resp.json()
  const initialCount = todosBody.todos.length
  
  expect(initialCount).toBeGreaterThan(0)
  
  // Удаляем все todos по одному
  for (const todo of todosBody.todos) {
    resp = await request.delete(`${testinfo.project.use.apiURL}/todos/${todo.id}`, {
      headers: { "x-challenger": token }
    })
    expect(resp.status()).toBe(200)
  }
  
  // Проверяем, что все todos удалены
  resp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
    headers: { "x-challenger": token }
  })
  
  todosBody = await resp.json()
  expect(todosBody.todos.length).toBe(0)
})

test("POST /todos (201) all @api @api @api @positive", async ({ request }, testinfo) => {
  const maxTodos = 20
  
  let todosResp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
    headers: { "x-challenger": token }
  })
  
  let todosBody = await todosResp.json()
  
  for (const todo of todosBody.todos) {
    await request.delete(`${testinfo.project.use.apiURL}/todos/${todo.id}`, {
      headers: { "x-challenger": token }
    })
  }

  for (let i = 1 ; i <= maxTodos ; i++) {
    const resp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
      headers: { "x-challenger": token },
      data: {
        title: `Todo ${i}`,
        doneStatus: false,
        description: `Description for todo ${i}`
      }
    })
    
    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.title).toBe(`Todo ${i}`)
  }
  
  // Проверяем, что создано максимальное количество
  todosResp = await request.get(`${testinfo.project.use.apiURL}/todos`, {
    headers: { "x-challenger": token }
  })
  
  todosBody = await todosResp.json()
  expect(todosBody.todos.length).toBe(maxTodos)
  
  // Проверяем, что больше создать нельзя (должен вернуться 400)
  const extraResp = await request.post(`${testinfo.project.use.apiURL}/todos`, {
    headers: { "x-challenger": token },
    data: {
      title: "Extra todo",
      doneStatus: false
    }
  })
  
  expect(extraResp.status()).toBe(400)
  const errorBody = await extraResp.json()
  expect(errorBody).toHaveProperty("errorMessages")
})


})
