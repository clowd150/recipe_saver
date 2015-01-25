var express = require('express');
var bodyParser = require('body-parser');
var bcrypt = require('bcryptjs');
//var csrf = require('csurf');
var mongoose = require('mongoose');
var sessions = require('client-sessions');

var url = require('url');

var Schema = mongoose.Schema; //allows use to define our schema
var ObjectId = Schema.ObjectId;

//CONNECT TO MONGO
mongoose.connect('mongodb://localhost/auth');

//User is a mongoose model (meaning it represents a user in the database). Then specify a schema, which is how the data is going to be represented in the db. List the fields and what type of value they are. The id is the value that MongoDB provides us.
var User = mongoose.model('User', new Schema({
	id: ObjectId,
	firstName: String,
	lastName: String,
	email: { type: String, unique: true },
	password: String,
	sortStyle: String
}));

var Recipe = mongoose.model('Recipe', new Schema({
	id: ObjectId,
	user_id: String,
	recipeName: String,
	url: String,
	notes: String,
	tags: [String]
}));

var app = express();
app.set('view engine', 'ejs');
app.locals.pretty = true;
app.use(express.static('public'));

//MIDDLEWARE
//This middleware takes the body of the http request from the user and make it available via req.body and allow us to access it.
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessions({
	cookieName: 'session',
	secret: "*-dafdpas23rsda232222;;al;",
	duration: 30 * 60 * 1000,
	activeDuration: 5 * 60 * 1000
}));

//app.use(csrf());

app.use(function(req, res, next) {
	if (req.session && req.session.user) {
		User.findOne({ email: req.session.user.email }, function(err, user) {
			if (err) console.log("ALERT!!! NO USER FOUND!!");
			if (user) {
				req.user = user;
				delete req.user.password;
				req.session.user = user;
				res.locals.user = user;
				if (res.locals.user.sortStyle == "default") {
					Recipe.find({ user_id: res.locals.user.email }, function(err, recipes) {
						if (err) throw err;
						console.log("User::: " + res.locals.user.email);
						console.log("THE RECIPES: " + recipes);
						res.locals.user.recipes = recipes;
						next();
					});
				} else if (res.locals.user.sortStyle == "ZA") {
					Recipe.find({ user_id: req.session.user.email }).sort({recipeName: 1}).exec(function (err, recipes) {
						if (err) throw err;
						recipes.forEach(function(doc) {
							res.locals.user.recipes = recipes;
						});
						console.log("ZA is now set");
						next();
					});
				} else if (res.locals.user.sortStyle == "AZ") {
					Recipe.find({ user_id: req.session.user.email }).sort({recipeName: -1}).exec(function (err, recipes) {
						if (err) throw err;
						recipes.forEach(function(doc) {
							res.locals.user.recipes = recipes;
						});
						console.log("AZ is now set");
						next();
					});
				} else {
					Recipe.find({ user_id: req.session.user.email }, function(err, recipes) {
						if (err) throw err;
						recipes.forEach(function(doc) {
							res.locals.user.recipes = recipes;
						});
						console.log("default2 is now set");
						next();
					});
				}
			} else {
				console.log("ALERT!!! NO USER FOUND!!");
			}
		});
	} else {
		next();
	}
});


function requireLogin(req, res, next) {
	if (!req.user) {
		res.redirect('/login');
	} else {
		next();
	}
}

app.get('/', function(req, res) {
	res.render('index.ejs');
});

app.get('/register', function(req, res) {
	res.render('register.ejs'/*, { csrfToken: req.csrfToken() } */);
});

app.post('/register', function(req, res) {
	var hash = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));
	var user = new User({
		firstName: req.body.firstName,
		lastName: req.body.lastName,
		email: req.body.email,
		password: hash,
		sortStyle: "default"
	});
	user.save(function(err) {
		if (err) {
			var err = 'Something bad happened! Try again!';
			if (err.code === 11000) { //this is the error mongoDB returns if something's nonunique
				err = 'That email is already taken, try another.';
			}

			res.render('register.ejs', { error: error });
		} else {
			res.redirect('/dashboard');
		}
	});
});

app.get('/login', function(req, res) {
	res.render('login.ejs'/*, { csrfToken: req.csrfToken() } */);
});

app.post('/login', function(req, res) {
	User.findOne({ email: req.body.email }, function(err, user) {
		if (!user) {
			res.render('login.ejs', { error: 'Invalid email or password.'});
		} else {
			if (bcrypt.compareSync(req.body.password, user.password)) {
				req.session.user = user; //set-cookie: session={email: ..., password: ..., ..}
				res.redirect('/dashboard');
			} else {
				res.render('login.ejs', { error: 'Invalid email or password.'});				
			}
		}
	});
});

app.get('/dashboard', requireLogin, function(req, res) {
	res.render('dashboard.ejs');
});

app.get('/profile', requireLogin, function(req, res) {
	res.render('profile.ejs'/*, { csrfToken: req.csrfToken() } */);
	//console.log(req.session.user.email);
	//console.log(req.session.user);
});

app.get('/recipelist', requireLogin, function(req, res) {
	res.render('recipelist.ejs');
});

// POST RECIPE
app.post('/profile', requireLogin, function(req, res) {
	var formattedUrl = formatUrl(req);
	var tagsArray = req.body.tags.split(',');
	var recipe = new Recipe({
		user_id: req.session.user.email,
		recipeName: req.body.recipe,
		url: formattedUrl,
		notes: req.body.notes,
		tags: tagsArray
	});
	console.log("Posting a recipe");
	recipe.save(function(err, thor) {
	  if (err) return console.error(err);
	  console.dir(thor);
	});
	User.findOne({ email: req.session.user.email }, function (err, user) {
		user.sortStyle = "default";
		user.save(function(rec) {
			console.log("Sort style set to default");
		});
	});
	res.redirect('/profile');
});

// UPDATE NAME
app.post('/updateName/:recordID', requireLogin, function(req, res) {
	Recipe.findOne({ _id: req.params.recordID }, function(err, recipe) {
	if (err) return console.error(err);
		recipe.recipeName = req.body.newname;
		recipe.save(function(err) {
			if (err) return console.error(err);
			console.log(recipe.recipeName + " was updated.");
			console.log(recipe);
			res.sendStatus(201);
		});
	});
});

// UPDATE URL
app.post('/updateUrl/:recordID', requireLogin, function(req, res) {
	console.log(req.body.newurl);
	Recipe.findOne({ _id: req.params.recordID }, function(err, recipe) {
		if (err) return console.error(err);
		var formattedUrl = formatUrlUpdate(req);
		recipe.url = formattedUrl;
		recipe.save(function(err) {
			if (err) return console.error(err);
			console.log(recipe.url + " was updated.");
			console.log(recipe);
			res.sendStatus(201);
		});
	});
});

// UPDATE NOTE
app.post('/updateNote/:recordID', requireLogin, function(req, res) {
	console.log(req.body.newnote);
	Recipe.findOne({ _id: req.params.recordID }, function(err, recipe) {
		if (err) return console.error(err);
		recipe.notes = req.body.newnote;
		recipe.save(function(err) {
			if (err) return console.error(err);
			console.log(recipe.notes + " was updated.");
			console.log(recipe);
			res.sendStatus(201);
		});
	});
});

// DELETE RECIPE ENTRY
app.get('/profile/delete/:recordID', requireLogin, function(req, res) {
	Recipe.remove({ _id: req.params.recordID }, function(err, recipe) {
		if (err) return console.error(err);
		console.log("params ID: "  + req.params.recordID);
		console.log(recipe + " doc was removed.");
		res.sendStatus(201);
	});
});

// SORT BY TAGN 
app.get('/profile/tags/:tag', requireLogin, function(req, res) {
	console.log("TAG NAME: " + req.params.tag);
	// Recipe.remove({ _id: req.params.recordID }, function(err, recipe) {
	// 	if (err) return console.error(err);
	// 	console.log("params ID: "  + req.params.recordID);
	// 	console.log(recipe + " doc was removed.");
	// 	res.sendStatus(201);
	// });
});

// SORT Z - A
app.get('/profile/sortZA', function(req, res) {
	User.findOne({ email: req.session.user.email }, function (err, user) {
		user.sortStyle = "ZA";
		user.save(function(rec) {
			console.log("Sort style set to ZA");
			console.log("Returned User" + user);
			res.sendStatus(200);
		});
	});
});

// SORT A - Z
app.get('/profile/sortAZ', function(req, res) {
	User.findOne({ email: req.session.user.email }, function (err, user) {
		user.sortStyle = "AZ";
		user.save(function(rec) {
			console.log("Sort style set to AZ");
			console.log("Returned User" + user);
			res.sendStatus(200);
		});
	});
});


app.get('/logout', function(req, res) {
	req.session.reset();
	res.redirect('/');
});


app.listen(3000, function(req, res) {
	console.log('App listening on port 3000');
});


function formatUrl(req) {
	console.log("Default: " + url.parse(req.body.url, true).href);
	var href = url.parse(req.body.url, true).href;
	var protocol = url.parse(req.body.url, true).protocol;
	var path = url.parse(req.body.url, true).path;
	var formattedUrl;
	console.log(href);
	console.log(protocol);
	console.log(path);
	console.log("REQUEST LENTGH: " + req.body.url.length);
	if (!protocol && req.body.url.length >= 1) {
		formattedUrl = "http://" + href;
	} else {
		formattedUrl = href;
	}
	return formattedUrl;
}

function formatUrlUpdate(req) {
	console.log("Default: " + url.parse(req.body.newurl, true).href);
	var href = url.parse(req.body.newurl, true).href;
	var protocol = url.parse(req.body.newurl, true).protocol;
	var path = url.parse(req.body.newurl, true).path;
	var formattedUrl;
	console.log(href);
	console.log(protocol);
	console.log(path);
	if (!protocol && req.body.newurl.length >= 1) {
		formattedUrl = "http://" + href;
	} else {
		formattedUrl = href;
	}
	return formattedUrl;
}