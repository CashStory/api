import app from "../server/app";
import { initDb, closeDb } from '../server/services/mongoose';
import { seedDb, cleanDb }  from '../server/services/seedDb';
import * as request from 'supertest';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

let userToken;

const testSM = 'sm_test';
console.info =
console.error =
console.log =
jest.fn();

beforeAll(async () => {
  await initDb(process.env.MONGODB_URI);
  await seedDb();
});

afterAll(async () => {
  await cleanDb(testSM);
  await cleanDb();
  await closeDb();
});

// auth
describe("Login and password", () => {

  test(`Provided existing login`, async (done) => {
    await request(app)
      .post('/api/v1/auth/login')
      .send('username=bob@cashstory.com&password=bobworkspace')
      .expect(200)
      .expect(response => {
          userToken = response.body.token;
      });
    done();
  })

  test(`Provided non-existing login`, async (done) => {
    await request(app)
      .post('/api/v1/auth/login')
      .send('username=no-email@cashstory.com&password=no-password')
      .expect(403)
    done();
  })

});

describe("Reset password", () => {

  test(`Provided existing email`, async (done) => {
    await request(app)
      .post('/api/v1/auth/resetpwd')
      .send('email=test@cashstory.com')
      .expect(200,{ email: 'send' })
    done();
  })

  test(`Provided non-existing email`, async (done) => {
    await request(app)
      .post('/api/v1/auth/resetpwd')
      .send('email=no-email@cashstory.com')
      .expect(400,{ error: "Cannot set property 'password' of null" })
    done();
  })

});

// me
describe("User Profile", () => {
  let profileDetail;
  test(`Get profile detail`, async (done) => {
    await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

  test(`Update profile detail`, async (done) => {
    await request(app)
      .put('/api/v1/users/me')
      .send('firstName=UpdatedName&password=bobworkspace')
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        if(response.body.firstName!="UpdatedName") throw new Error("Value not updated")
      })
    done();
  })

  let favouriteData = {"name":"Reference documentation","description":null,"attachement":"https://access42.net/IMG/arton479.jpg?1520440320","attachement_type":"image","wp":{"box":"5da87b33502d6ce4963aa7cb","id":"5cc22e6efc3b6947d92d37f2","section":3},"column":12}

  test(`Add to favorite`, async (done) => {
    await request(app)
      .post('/api/v1/users/me/favorite')
      .send(favouriteData)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

});

// user

describe("Operations about user", () => {
  test(`Get all users`, async (done) => {
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

  let insertData = {
    email: 'newuser@cashstory.com', role: 'admin', tmpAccount: false,
    password: 'newuser', firstName: 'New User', lastName: 'Cashstory',
    workspaces: {
      '5eaa9b7c87e99ef2430a270a': {
        news: { sources: [], categories: [], name: 'News' },
        favorites: {
          boxes: [],
          class: 'col-12 col-md-6 px-0 px-md-3', name: 'Favoris',
        }, name: 'My Workspace',
      },
      '5cc22e6efc3b6947d92d37f2': {
        news: { sources: [], categories: [], name: 'News', lang: 'en' },
        favorites: {
          boxes: [], name: 'Favoris',
        },
        name: 'admin',
      },
    },
  }

  let insertedId;
  test(`Insert users`, async (done) => {
    await request(app)
      .post('/api/v1/users')
      .send(insertData)
      .set('Authorization', "Bearer "+userToken)
      .expect((response) => {
        insertedId = response.body._id
      })
    done();
  })

    test(`Count users`, async (done) => {
      await request(app)
        .get('/api/v1/users/count')
        .set('Authorization', "Bearer "+userToken)
        .expect(200)
      done();
    })

    test(`Get user by id`, async (done) => {
      await request(app)
        .get('/api/v1/users/'+insertedId)
        .set('Authorization', "Bearer "+userToken)
        .expect(200)
      done();
    })

    let updateData = {
      email: 'newuser@cashstory.com', role: 'admin', tmpAccount: false,
      password: 'newuser', firstName: 'UpdatedName2', lastName: 'Cashstory',
      workspaces: {
        '5eaa9b7c87e99ef2430a270a': {
          news: { sources: [], categories: [], name: 'News' },
          favorites: {
            boxes: [],
            class: 'col-12 col-md-6 px-0 px-md-3', name: 'Favoris',
          }, name: 'My Workspace',
        },
        '5cc22e6efc3b6947d92d37f2': {
          news: { sources: [], categories: [], name: 'News', lang: 'en' },
          favorites: {
            boxes: [], name: 'Favoris',
          },
          name: 'admin',
        },
      },
    }

    test(`Update user by id`, async (done) => {
      await request(app)
        .put('/api/v1/users/'+insertedId)
        .send(updateData)
        .set('Authorization', "Bearer "+userToken)
        .expect(200)
        .expect((response) => {
          if(response.body.firstName!="UpdatedName2") throw new Error("User not updated")
        })
      done();
    })

    test(`Delete user by id`, async (done) => {
      await request(app)
        .delete('/api/v1/users/'+insertedId)
        .send(updateData)
        .set('Authorization', "Bearer "+userToken)
        .expect(200)
      done();
    })


});

// workspaces
let workspaceInserted;
describe("Operations about workspaces", () => {
  test(`Get all workspace`, async (done) => {
    await request(app)
      .get('/api/v1/workspaces')
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

  test(`Count workspaces`, async (done) => {
    await request(app)
      .get('/api/v1/workspaces/count')
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

  let insertData = {
    "logo": {
      "url": ".../../../assets/logo/nexity.png",
      "name": "testUpload"
    },
    "name": "New Workspace",
    "menu": [{
      "title": "Toucan Toco",
      "icon": "tablet",
      "sectionId": 1
    }, {
      "title": "Task Manager",
      "icon": "tasks",
      "sectionId": 2
    }],
    "sections": [{
      "box": [{
        "hideElements": [],
        "_id": "5da87a01502d6c170b3aa64d",
        "name": "Toucan Toco",
        "color": "#ffffff",
        "backgroundColor": "#a0a0a0",
        "iframe": true,
        "zoom": 100,
        "urlBg": "https://api.toucan.cashstory.com/cashstory-demo/assets/bg-1?decache=1568240830525",
        "url": "https://viz.cashstory.com/cashstory-demo?report=0&dashboard=0",
        "autoExpand": true,
        "position": 0,
        "authMethod": "toucan",
        "login": {
        }
      }],
      "id": 1,
      "title": "Stories",
      "description": "Follow your financial & extra-financial performance"
    }]
  };



  test(`Insert workspace`, async (done) => {
    await request(app)
      .post('/api/v1/workspaces')
      .send(insertData)
      .set('Authorization', "Bearer "+userToken)
      .expect(201)
      .expect((response) => {
        workspaceInserted = response.body._id
      })
    done();
  })

  test(`Get workspace by id`, async (done) => {
    await request(app)
      .get('/api/v1/workspaces/'+workspaceInserted)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

  let updateData = {
    "logo": {
      "url": ".../../../assets/logo/nexity.png",
      "name": "testUpload"
    },
    "name": "Update Workspace",
    "menu": [{
      "title": "Toucan Toco",
      "icon": "tablet",
      "sectionId": 1
    }, {
      "title": "Task Manager",
      "icon": "tasks",
      "sectionId": 2
    }],
    "sections": [{
      "box": [{
        "hideElements": [],
        "_id": "5da87a01502d6c170b3aa64d",
        "name": "Toucan Toco",
        "color": "#ffffff",
        "backgroundColor": "#a0a0a0",
        "iframe": true,
        "zoom": 100,
        "urlBg": "https://api.toucan.cashstory.com/cashstory-demo/assets/bg-1?decache=1568240830525",
        "url": "https://viz.cashstory.com/cashstory-demo?report=0&dashboard=0",
        "autoExpand": true,
        "position": 0,
        "authMethod": "toucan",
        "login": {
        }
      }],
      "id": 1,
      "title": "Stories",
      "description": "Follow your financial & extra-financial performance"
    }]
  }

  test(`Update workspace by id`, async (done) => {
    await request(app)
      .put(`/api/v1/workspaces/${workspaceInserted}`)
      .send(updateData)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        if(response.body.name!="Update Workspace") throw new Error("Workspace not updated")
      })
    done();
  })

  // test(`Delete workspace by id`, async (done) => {
  //   await request(app)
  //     .delete('/api/v1/workspaces/'+workspaceInserted)
  //     .set('Authorization', "Bearer "+userToken)
  //     .expect(200)
  //   done();
  // })

});

// workspace box


describe("Manage box in workspace section", () => {
  let boxId;
  let boxData = {"name":"New Box","color":"#ffffff","backgroundColor":"#a0a0a0","urlBg":"https://api.toucan.cashstory.com/cashstory-demo/assets/bg-1?decache=1568240830525","url":"https://google.com","iframe":false,"autoExpand":false,"authMethod":"","login":{"username":"admin","password":"password"}}

  test(`Add new box in a section`, async (done) => {
    await request(app)
      .post(`/api/v1/workspaces/${workspaceInserted}/section/1/box`)
      .send(boxData)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        boxId = response.body.sections[0].box[1]._id
      })
    done();
  })

  let boxupdateData = {"name":"Updated Box","color":"#ffffff","backgroundColor":"#a0a0a0","urlBg":"https://api.toucan.cashstory.com/cashstory-demo/assets/bg-1?decache=1568240830525","url":"https://google.com","iframe":false,"autoExpand":false,"authMethod":"","login":{"username":"admin","password":"password"}}

  test(`Update workspace box by id`, async (done) => {
    await request(app)
      .put(`/api/v1/workspaces/${workspaceInserted}/section/1/box/${boxId}`)
      .send(boxupdateData)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        if(response.body.sections[0].box[1].name!="Updated Box") throw new Error("Box not updated")
      })
    done();
  })

    test(`Delete workspace box by id`, async (done) => {
    await request(app)
      .delete(`/api/v1/workspaces/${workspaceInserted}/section/1/box/${boxId}`)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

});

describe("Display table", () => {

  let smarttableData = {"name":"Test Name"}
  let smarttableInserted;
  test(`Insert smarttable`, async (done) => {
    await request(app)
      .post(`/api/v1/smarttables/${testSM}/workspaces`)
      .send(smarttableData)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        smarttableInserted = response.body.insertedIds[0]
      })
    done();
  })

  test(`Get smarttable`, async (done) => {
    await request(app)
      .get(`/api/v1/smarttables/${testSM}/workspaces/`)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        // console.log(response.body)
      })
    done();
  })

  test(`Count smarttable`, async (done) => {
    await request(app)
      .get(`/api/v1/smarttables/${testSM}/workspaces/count`)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
      .expect((response) => {
        if(response.body!=1) throw new Error("Invalid count")
      })
    done();
  })


  let smarttableUpdate = {"_id":smarttableInserted,"name":"Updated Name"}

  test(`Update smartatable from db collection`, async (done) => {
    await request(app)
      .put(`/api/v1/smarttables/${testSM}/workspaces/${smarttableInserted}`)
      .send(smarttableUpdate)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

    test(`Delete smartable by id`, async (done) => {
    await request(app)
      .delete(`/api/v1/smarttables/${testSM}/workspaces/${smarttableInserted}`)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })

});

  test(`Delete workspace by id`, async (done) => {
    await request(app)
      .delete(`/api/v1/workspaces/${workspaceInserted}`)
      .set('Authorization', "Bearer "+userToken)
      .expect(200)
    done();
  })
