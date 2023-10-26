/** @format */
require("dotenv").config();
const express = require("express");
const path = require('path');
const session = require("express-session");
const mongoose = require('mongoose')
const passport = require("passport");
const User = require("./models/User");
const userRoutes = require("./routes/user")
const projectRoutes = require("./routes/project")

const app = express();


app.set("view engine", "ejs");


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "my little secret.",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

const methodOverride = require('method-override');
app.use(methodOverride('_method'));


mongoose.set("strictQuery", true);
mongoose.connect("mongodb://localhost:27017/projectArchiveDB")
  .then(() => {
    console.log("Connected to the database");
  })
  .catch(err => {
    console.error("Error connecting to the database:", err);
  });


passport.use(User.createStrategy());
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});


app.get('/', (req, res) => {
  res.render('home');
});

const secureRoute = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login");
  }
};


app.use("/api",userRoutes);
app.use("/api",projectRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
