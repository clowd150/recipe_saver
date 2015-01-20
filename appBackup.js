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
	recipes: [{ recipeName: String, url: String, notes: String }]
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
			if (user) {
				req.user = user;
				delete req.user.password;
				req.session.user = user;
				res.locals.user = user;
			}
			next();
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
		password: hash
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


// POST RECIPE
app.post('/profile', function(req, res) {
	User.findOne({ email: req.session.user.email }, function(err, user) {
		var formattedUrl = formatUrl(req);
		user.recipes.push({ recipeName: req.body.recipe, url: formattedUrl, notes: req.body.notes });
		//user.recipes.push(req.body.recipe);
		//user.urls.push(req.body.url);
		user.save(function(err, thor) {
		  if (err) return console.error(err);
		  console.dir(thor);
		});
		res.redirect('/profile');
	});
});

// UPDATE NAME
app.post('/updateName/:recordID', function(req, res) {
	User.findOne({ email: req.session.user.email }, function(err, user) {
		if (err) return console.error(err);
		var result = user.recipes.filter(function( obj ) {
			return (obj._id == req.params.recordID);
		});
		var y = user.recipes.indexOf(result[0]);
		user.recipes[y].recipeName = req.body.newname;
		user.save(function (err) {
			if (err) return console.error(err);
			console.log('the sub-doc was updated')
		});
		console.log(user);
		res.sendStatus(201);
	});
});

// UPDATE URL
app.post('/updateUrl/:recordID', function(req, res) {
	console.log(req.body.newurl);
	User.findOne({ email: req.session.user.email }, function(err, user) {
		if (err) return console.error(err);
		var result = user.recipes.filter(function( obj ) {
			return (obj._id == req.params.recordID);
		});
		var y = user.recipes.indexOf(result[0]);
		var formattedUrl = formatUrlUpdate(req);
		user.recipes[y].url = formattedUrl;
		user.save(function (err) {
			if (err) return console.error(err);
			console.log('the sub-doc was updated')
		});
		console.log(user);
		res.sendStatus(201);
	});
});

// UPDATE NOT
app.post('/updateNote/:recordID', function(req, res) {
	console.log(req.body.newnote);
	User.findOne({ email: req.session.user.email }, function(err, user) {
		if (err) return console.error(err);
		var result = user.recipes.filter(function( obj ) {
			return (obj._id == req.params.recordID);
		});
		var y = user.recipes.indexOf(result[0]);
		user.recipes[y].notes = req.body.newnote;
		user.save(function (err) {
			if (err) return console.error(err);
			console.log('the sub-doc was updated')
		});
		console.log(user);
		res.sendStatus(201);
	});
});

// DELETE RECIPE ENTRY
app.get('/profile/delete/:recipeID', function(req, res) {
	User.findOne({ email: req.session.user.email }, function(err, record) {
		if (err) return console.error(err);
		var result = record.recipes.filter(function( obj ) {
			return (obj._id == req.params.recipeID);
		});
		//console.log(result[0]);
		var y = record.recipes.indexOf(result[0]);
		var myRemoval = record.recipes[y].remove();
		record.save(function (err) {
			if (err) return console.error(err);
			console.log('the sub-doc was removed')
		});
		res.redirect('/profile');
	});
});


app.get('/profile/sortZA', function(req, res) {
	User.findOne({ email: req.session.user.email }, function(err, record) {
		if (err) return console.error(err);
		record.recipes.sort(function(a, b){
			var nameA = a.recipeName.toLowerCase(), nameB = b.recipeName.toLowerCase()
			if (nameA < nameB) //sort string ascending
			return -1 
			if (nameA > nameB)
			return 1
			return 0 //default return value (no sorting)
		});
		console.log(record.recipes);
		record.save(function (err) {
			if (err) return console.error(err);
			console.log('the sub-doc was sorted')
		});

		res.redirect('/profile');
	});
});

app.get('/profile/sortAZ', function(req, res) {
	User.findOne({ email: req.session.user.email }, function(err, record) {
		if (err) return console.error(err);
		record.recipes.sort(function(a, b){
			var nameA = a.recipeName.toLowerCase(), nameB = b.recipeName.toLowerCase()
			if (nameB < nameA) //sort string ascending
			return -1 
			if (nameB > nameA)
			return 1
			return 0 //default return value (no sorting)
		});
		console.log(record.recipes);
		record.save(function (err) {
			if (err) return console.error(err);
			console.log('the sub-doc was sorted')
		});

		res.redirect('/profile');
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