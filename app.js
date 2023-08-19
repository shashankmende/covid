const express = require("express");
const app = express();
app.use(express.json());
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
let db = null;
const initializeDbandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbandServer();

const Authenticate = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "secretkey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(username, password);

  const userExistQuery = `
  
  select * from user
  where username = '${username}'

  `;
  const isUserExist = await db.get(userExistQuery);
  console.log(isUserExist);
  if (isUserExist === undefined) {
    //
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      isUserExist.password
    );
    console.log(isPasswordMatched);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretkey");
      console.log(jwtToken);
      response.send({
        jwtToken: jwtToken,
      });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/login/", Authenticate, async (request, response) => {});

app.get("/states/", Authenticate, async (request, response) => {
  const query = `
    
    select * from state;
    
    `;
  const statesList = await db.all(query);
  response.send(
    statesList.map((eachstate) => {
      return {
        stateId: eachstate.state_id,
        stateName: eachstate.state_name,
        population: eachstate.population,
      };
    })
  );
});

//API 3
app.get("/states/:stateId/", Authenticate, async (request, response) => {
  const { stateId } = request.params;
  const query = `
    
    select * from state where state_id = ${stateId}
    
    `;
  const state = await db.get(query);
  const outputFormat = (eachstate) => {
    return {
      stateId: eachstate.state_id,
      stateName: eachstate.state_name,
      population: eachstate.population,
    };
  };

  response.send(outputFormat(state));
});

//API 4
app.post("/districts/", Authenticate, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  console.log(districtName);
  const insertQuery = `
  
  insert into district (district_name,state_id,cases,cured,active,deaths)
  values('${districtName}',${stateId},${cases},${cured},${active},${deaths})
  
  `;
  await db.run(insertQuery);
  response.send("District Successfully Added");
});

//API 5
app.get("/districts/:districtId/", Authenticate, async (request, response) => {
  const { districtId } = request.params;
  const getDistrict = `
    
    select * from district where district_id = ${districtId}
    
    `;
  const district = await db.get(getDistrict);

  const outputFormat = (district) => {
    return {
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    };
  };
  response.send(outputFormat(district));
});

//API 6
app.delete(
  "/districts/:districtId/",
  Authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuert = `
        delete from district where district_id = ${districtId}
        `;
    await db.run(deleteQuert);
    response.send("District Removed");
  }
);

//API 7
app.put("/districts/:districtId/", Authenticate, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateQuery = `
   
   update district set 
   district_name = '${districtName}',
   state_Id = ${stateId},
   cases =${cases},
   cured = ${cured},
   active= ${active},
   deaths= ${deaths}
   where district_id = ${districtId}
   `;
  await db.run(updateQuery);
  response.send("District Details Updated");
});

//api 8
app.get("/states/:stateId/stats/", Authenticate, async (request, response) => {
  const { stateId } = request.params;
  const query = `
    
    select 
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    from district 
    where state_id = ${stateId}
    
    `;
  const result = await db.get(query);
  response.send(result);
});

module.exports = app;
