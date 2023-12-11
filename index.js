const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "goodreads.db");
const app = express();

app.use(express.json());
// express.json() is a built-in middleware function. It recognizes the incoming
// request object as JSON object and parses it and then calls handler in every API call.

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username; // We cannot directly pass data to the next handler, but we can send data through the request object
        next(); // by calling this function..API handler is called (only when jwt token is valid)
      }
    });
  }
};

// The next parameter is a function passed by Express JS which, when invoked,
// executes the next succeeding function. Here next function is API handler (see get books API)

//Get Books API
app.get("/books/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
            SELECT
              *
            FROM
             book
            ORDER BY
             book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

//Get Book API
app.get("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const getBookQuery = `
            SELECT
            *
            FROM
            book 
            WHERE
            book_id = ${bookId};
            `;
  const book = await db.get(getBookQuery);
  response.send(book);
});

//User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// Middleware is a special kind of function in Express JS which accepts the request from
// the user (or)
// the previous middleware
// -------
// After processing the request the middleware function
// sends the response to another middleware (or)
// calls the API Handler (or)
// sends response to the user

//--------

// Get user profile API
app.get("/profile/", authenticateToken, async (request, response) => {
  let { username } = request; // see line 44
  const selectUserQuery = `
SELECT 
* 
FROM
user
WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery); //get bcz we need output in one line
  response.send(userDetails);
});
