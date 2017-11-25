"use strict";

require('dotenv').config();

const PORT        = process.env.PORT || 8080;
const ENV         = process.env.ENV || "development";
const cookieSession = require('cookie-session');
const express     = require("express");
const bodyParser  = require("body-parser");
const sass        = require("node-sass-middleware");
const app         = express();
const bcrypt = require('bcrypt');
const path = require('path');
const flash = require('connect-flash');

const knexConfig  = require("./knexfile");
const knex        = require("knex")(knexConfig[ENV]);
const morgan      = require('morgan');
const knexLogger  = require('knex-logger');

// Seperated Routes for each Resource
const usersRoutes = require("./routes/users");
const allMapsRoutes = require("./routes/all_maps");
const favoritesRoutes = require("./routes/favorites");
const contributionsRoutes = require("./routes/contributions");

app.set("view engine", "ejs");

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", sass({
  src: __dirname + "/styles",
  dest: __dirname + "/public/styles",
  debug: true,
  outputStyle: 'compressed'
}));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(cookieSession({
  name: 'session',
  keys: ['Cleo'],

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.use(flash());

app.use(express.static("public"));

// Mount all resource routes
app.use("/api/users", usersRoutes(knex));
app.use("/api/all_maps", allMapsRoutes(knex));
app.use("/api/favorites", favoritesRoutes(knex));
app.use("/api/contributions", contributionsRoutes(knex));

// Home page
app.get("/", (req, res) => {
  let loggedIn = false;
  if (req.session.user_id) {
    loggedIn = true;
  }
   let templateVars = {
                       loggedIn: loggedIn,
                       errors: req.flash('error')
                      };
  res.render("index", templateVars
  );
});


app.get("/profile", (req, res) => {
  let loggedIn = false;
  if (req.session.user_id) {
    loggedIn = true;
  }
   let templateVars = {
                       loggedIn: loggedIn,
                       userid: req.session.user_id,
                       errors: req.flash('error')
                      };
  res.render("profile", templateVars
  );
});

app.get("/new-map", (req, res) => {
  res.render("new-map");
});

// TO DO MOVE THIS TO HELP FUNCTIONS
function registerUser(email, password) {
  let user_id = 0;
  return knex('users')
    .insert({
      email: email,
      password: password
    })
    .returning('*')
    .then((users) => {
      console.log(users[0].id);
      user_id = users[0].id;
      return user_id;
    });
}


function checkEmailInDB(email) {
  return knex
    .select('email')
    .from('users')
    .where({'email': email})
    .then((users) => {
      return users.length !== 0;
    });
}

function checkLogin(emailreq, password) {
  return knex('users')
  .where({ email: emailreq })
  .returning('*')
  .then((result) => {
    if (bcrypt.compareSync(password, result[0].password))  {
      return result[0].id;
    } else {
      return false;
    }
  });
}


// Test route // TO DO TO DO TO DO
app.get("/login-test", (req, res) => {
  res.render("login-test");
});

app.get("/profile", (req, res) => {
  res.render("profile");
});

app.get("/maps/:id", (req, res) => {
  let loggedIn = false;
  if (req.session.user_id) {
    loggedIn = true;
  }
  let mapData = {};
  knex('maps').select().where('id', req.params.id)

    .asCallback(function (err, rows) {
    mapData = rows[0];
    console.log(rows);
    let dataTemplate = {
      map_data1: mapData
    };
    dataTemplate = JSON.stringify(dataTemplate);
      res.render('map_page', {data: dataTemplate, errors: req.flash('error'), loggedIn: loggedIn});
    });
});




app.post("/logout", (req, res) => {
  // console.log('logout id',req.session.user_id);
  req.session.user_id = null;
  // console.log('logout id after logout',req.session.user_id);
  res.redirect('/');
});


app.post('/login', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if (!req.body.email || !req.body.password) {
    req.flash('error', 'Both email and password are required');
    res.redirect(req.get('referer'));
    return;
  }
  checkLogin(email, password)
  .then(exists => {
    // console.log('I am the result of the function promise',exists);
  if (exists) {
    req.session.user_id = exists;
    console.log(req.session.user_id);
    res.redirect('/');
  }
    else {
      req.flash('error', 'Email and password do not match');
      res.redirect('/');
    }


  });
});




app.post('/register', (req, res) => {
  const email = req.body.email;
  const password = bcrypt.hashSync(req.body.password, 10);
  if (!req.body.email || !req.body.password) {
    req.flash('error', 'Both email and password are required');
    res.redirect(req.get('referer'));
    return;
  }
  checkEmailInDB(email, password)
  .then(exists => {
    if (!exists) {
      return registerUser(email, password)
      .then(user_id => {
        req.session.user_id = user_id;
        // console.log('right after registration ',req.session.user_id);
        res.redirect('/');
      });
    } else {
      req.flash('error', 'Email is not unique');
      res.redirect(req.get('referer'));
    }
  });
});


app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
