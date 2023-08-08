/** @format */
require("dotenv").config();
const express = require("express");
const path = require('path');
const session = require("express-session");
const mongoose = require('mongoose')
const passport = require("passport");
const User = require("./models/User");
const adminRoutes = require("./routes/admin")
const projectRoutes = require("./routes/project")

const app = express();

// Set the view engine
app.set("view engine", "ejs");

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Use path.join for better cross-platform compatibility
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "my little secret.",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// Method override middleware
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// Connect to the MongoDB database
mongoose.set("strictQuery", true);
mongoose.connect("mongodb://localhost:27017/projectArchiveDB")
  .then(() => {
    console.log("Connected to the database");
  })
  .catch(err => {
    console.error("Error connecting to the database:", err);
  });

// Passport configuration
passport.use(User.createStrategy());
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

// Secure routes with authentication
const secureRoute = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login");
  }
};

app.get('/upload', secureRoute, (req, res) => {
  res.render('upload');
});

app.get('/search', (req, res) => {
  res.render('search');
});

app.get('/admin', secureRoute, (req, res) => {
  res.render('admin-home');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// Use route middleware
app.use(adminRoutes);
app.use(projectRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
