var express = require('express');
var bodyParser = require('body-parser');
var bcrypt = require('bcryptjs');
//var csrf = require('csurf');
var mongoose = require('mongoose');
var sessions = require('client-sessions');
var uriUtil = require('mongodb-uri');
var url = require('url');
var nodemailer = require('nodemailer');
var crypto = require('crypto');
var async = require('async');
var fs = require('fs');
var https = require('https');

var Schema = mongoose.Schema; //allows use to define our schema
var ObjectId = Schema.ObjectId;

var port = process.env.PORT || 3000;

var goDaddyPass = (process.env.PORT) ? process.env.GODADDY : fs.readFileSync('./public/godaddyemail.txt').toString();
var recaptchaSK = (process.env.PORT) ? process.env.RECAPTCHA : fs.readFileSync('./public/recaptchaSK.txt').toString();

// Database Options
var options = { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }, 
	replset: { socketOptions: { keepAlive: 1, connectTimeoutMS : 30000 } } };

//CONNECT TO MONGO
if (!process.env.PORT) {
	mongoose.connect('mongodb://localhost/auth');
} else {
	console.log("APP RUNNING IN HEROKU!!!");
	var mongodbUri = process.env.MONGOLAB_URI; // A Heroku config variable
	var mongooseUri = uriUtil.formatMongoose(mongodbUri);
	mongoose.connect(mongooseUri, options);
}

//User is a mongoose model (meaning it represents a user in the database). Then specify a schema, which is how the data is going to be represented in the db. List the fields and what type of value they are. The id is the value that MongoDB provides us.
var User = mongoose.model('User', new Schema({
	id: ObjectId,
	name: String,
	email: { type: String, unique: true, lowercase: true, trim: true },
	password: String,
	resetPasswordToken: String,
    resetPasswordExpires: String,
    creationDate: {type: Date, default: Date.now}
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
	duration: 60 * 60 * 1000, //Initial session is good for 1 hour
	activeDuration: 30 * 60 * 1000 //Lengthen session by 30 mins
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
		console.log("kicked out!")
	} else {
		next();
	}
}


// Render Account Recovery Page
app.get('/accountrecovery', function(req, res) {
	var message = {error: 'none'};
	res.render('accountrecovery.ejs', message);
});

// Send Account Recovery Email
app.post('/accountrecovery', function(req, res, next) {
	verifyRecaptcha(req.body["g-recaptcha-response"], function(success) {
        if (success) {
            var email;
			  async.waterfall([
			    function(done) {
			      crypto.randomBytes(20, function(err, buf) {
			        var token = buf.toString('hex');
			        done(err, token);
			      });
			    },
			    function(token, done) {
			      User.findOne({ email: req.body.email }, function(err, user) {
			        if (!user) {
			          var message = {error: 'No account with that email address exists.'};
			          res.render('accountrecovery.ejs', message);
			          return;
			        }

			        user.resetPasswordToken = token;
			        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

			        user.save(function(err) {
			          done(err, token, user);
			        });
			      });
			    },
			    function(token, user, done) {
					var transporter = nodemailer.createTransport({
						host: 'smtpout.secureserver.net', 
						port: 465, 
						auth: { 
							user: 'info@recipesaver.net',
							pass: goDaddyPass
						},
						secure: true
					});
					email = user.email;
				    var mailOptions = {
				        to: user.email,
				        from: 'info@recipesaver.net',
				        subject: 'Recipe Saver Password Reset',
				        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
				          'Please click on the following link, or paste this into your browser to reset your password:\n\n' +
				          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
				          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
				    };
			      transporter.sendMail(mailOptions, function(err) {
			      	transporter.close();
			        done(err, 'done');
			      });
			    }
			  ], function(err) {
			    if (err) return next(err);
			    var message = {error: 'An e-mail has been sent to ' + email + ' with further instructions.'};
			    res.render('accountrecovery.ejs', message);
			  });
        } else {
			var message = {error: 'Incorrect captcha. Please prove your humanity!'};
			res.render('accountrecovery.ejs', message);
        }
	});
});


app.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      console.log('Password reset token is invalid or has expired.!!');
      return res.redirect('/oops');
    }
    console.log("Rendering reset view...");
    res.render('reset.ejs', {user: user.email});
  });
});

app.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
    	console.log(req.params.token);
    	console.log();
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
        	console.log('error!', 'Password reset token is invalid or has expired.');
          	return res.redirect('/oops');
        }
        var hash = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));
        user.password = hash;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.save(function(err) {
            done(err, user);
        });
      });
    },
    function(user, done) {
		var transporter = nodemailer.createTransport({
			host: 'smtpout.secureserver.net', 
			port: 465, 
			auth: { 
				user: 'info@recipesaver.net',
				pass: goDaddyPass
			},
			secure: true
		});
      var mailOptions = {
        to: user.email,
        from: 'info@recipesaver.net',
        subject: 'Your Recipe Saver password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      transporter.sendMail(mailOptions, function(err) {
        console.log('success', '!!!Success! Your password has been changed.');
        transporter.close();
        done(err);
      });
    }
  ], function(err) {
    //res.redirect('/login/recovered');
    var message = {reset: "Success! Your password has been changed. Please login to continue.", error: 'none'};
    res.render('login.ejs', message);
  });
});

app.get('/oops', function(req, res) {
	res.render('oops.ejs');
});


app.get('/', function(req, res) {
	res.render('index.ejs', {regMessage: 'none'});
});

// REGISTRATION PAGE
app.get('/register', function(req, res) {
	res.render('register.ejs', {regMessage: 'none'}/*, { csrfToken: req.csrfToken() } */);
});

// REGISTER USER
app.post('/', function(req, res) {
	verifyRecaptcha(req.body["g-recaptcha-response"], function(success) {
        if (success) {
			var hash = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));
			var user = new User({
				name: req.body.name,
				email: req.body.email,
				password: hash,
			});
			user.save(function(err) {
				if (err) {
					var errMessage = 'Something bad happened! Try again!';
					if (err.code === 11000) { //this is the error mongoDB returns if something's nonunique
						errMessage = 'That email is already taken, please try another one.';
					}
					res.render('index.ejs', { regMessage: errMessage });
				} else {
					sendWelcomeEmail(req.body.email, req.body.name);

						//Immediately log user in and send to their profile page
						User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
						if (!user) {
							res.render('login.ejs', { reset: 'none', error: 'Invalid email or password.'});
						} else {
							if (bcrypt.compareSync(req.body.password, user.password)) {
								req.session.user = user; //set-cookie: session={email: ..., password: ..., ..}
								res.redirect('/profile');
							} else {
								res.render('login.ejs', { reset: 'none', error: 'Invalid email or password.'});				
							}
						}
					});
				}

			});
		} else {
			res.render('index.ejs', {regMessage: 'Incorrect captcha. Please prove your humanity!'});
		}
	});
});

app.post('/login', function(req, res) {
	User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
		if (!user) {
			res.render('login.ejs', { reset: 'none', error: 'Invalid email or password.'});
		} else {
			if (bcrypt.compareSync(req.body.password, user.password)) {
				req.session.user = user; //set-cookie: session={email: ..., password: ..., ..}
				console.log(req.session.user);
				res.redirect('/profile');
			} else {
				console.log("wrong password or email, dude")
				res.render('login.ejs', { reset: 'none', error: 'Invalid email or password.'});				
			}
		}
	});
});

app.get('/login', function(req, res) {
	var message = {reset: 'none', error: undefined};
	res.render('login.ejs', message/*, { csrfToken: req.csrfToken() } */);
});


app.get('/logout', function(req, res) {
	req.session.reset();
	res.redirect('/');
});

app.get('/profile', requireLogin, function(req, res) {
	res.render('profile.ejs');
});

app.get('/profile', requireLogin, function(req, res) {
	res.render('profile.ejs'/*, { csrfToken: req.csrfToken() } */);
});

app.get('/recipelist', requireLogin, function(req, res) {
	Recipe.find({ user_id: res.locals.user.email }).sort({_id: 1}).exec(function (err, records) {
		if (err) throw err;
		//console.log("/RECIPELIST::: " + records);
		res.locals.recipes = records;
		res.render('recipelist.ejs', res.locals.recipes);
	});
});

// POST RECIPE
app.post('/profile', requireLogin, function(req, res) {
	var formattedUrl = formatUrl(req);
	var tagsArray = req.body.tags.split(', ');
	if (tagsArray[0] == "") {
		tagsArray = [];
	}
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

// SORT BY TAG
app.get('/profile/tags/:tag', requireLogin, function(req, res) {
	console.log("TAG NAME: " + req.params.tag);
	Recipe.find({ user_id: req.session.user.email, tags: { "$in": [req.params.tag] } }).sort({recipeName: 1}).exec(function (err, recipes) {
		console.log("TAGGED RECIPE RESULTS: "  + recipes);
		res.locals.recipes = recipes;
		res.render('filteredrecipes.ejs', res.locals.recipes);
	});
});

// SORT A - Z
app.get('/profile/sortAZ', function(req, res) {
	Recipe.find({ user_id: req.session.user.email }).sort({recipeName: 1}).exec(function (err, recipes) {
		if (err) throw err;
		recipes.sort(function(a, b){
			var nameA = a.recipeName.toLowerCase(), nameB = b.recipeName.toLowerCase()
			if (nameB < nameA) {//sort string ascending
				return -1;
			}
			if (nameB > nameA) {
				return 1;
			}
			return 0 //default return value (no sorting)
		});
		res.locals.recipes = recipes;
		console.log("RECIPS" + res.locals.recipes);
		res.render('filteredrecipes.ejs', res.locals.recipes);
	});
});


// SORT Z - A
app.get('/profile/sortZA', function(req, res) {
	Recipe.find({ user_id: req.session.user.email }).sort({recipeName: -1}).exec(function (err, recipes) {
		if (err) throw err;
		recipes.sort(function(a, b){
			var nameA = a.recipeName.toLowerCase(), nameB = b.recipeName.toLowerCase()
			if (nameA < nameB) {//sort string ascending
				return -1;
			}
			if (nameA > nameB) {
				return 1;
			}
			return 0 //default return value (no sorting)
		});
		res.locals.recipes = recipes;
		console.log("RECIPS" + res.locals.recipes);
		res.render('filteredrecipes.ejs', res.locals.recipes);
	});
});


// DELETE TAG
app.get('/deletetag/:recordID', requireLogin, function(req, res) {
	Recipe.update({ _id: req.params.recordID }, { $pull: {tags: req.query.tag} }, function(err, tag) {
		if (err) return console.error(err);
		console.log("Removed " + tag + " tag");
		res.sendStatus(201);
	});
});


// ADD NEW TAG
app.post('/updatetagname/:recordID', requireLogin, function(req, res) {
	console.log(req.body.newtag);
	var newtags = req.body.newtag.split(', ');
	if (newtags[0] == "") {
		newtags = [];
	}
	Recipe.update({ _id: req.params.recordID }, { $pushAll: {tags: newtags} }, function(err, tag) {
		if (err) return console.error(err);
		console.log("Added " + tag + " tag");
		res.sendStatus(201);
	});
});


app.listen(port, function(req, res) {
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

function sendWelcomeEmail(userEmail, userName) {
		// create reusable transporter object using SMTP transport
	var transporter = nodemailer.createTransport({
		host: 'smtpout.secureserver.net', 
		port: 465, 
		auth: { 
			user: 'info@recipesaver.net',
			pass: goDaddyPass
		},
		secure: true
	});

	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: 'Recipe Saver <info@recipesaver.net>', // sender address
	    to: userEmail, // list of receivers
	    subject: "Recipe Saver - You're In! ✔", // Subject line
	    text: userName + ", welcome to Recipe Saver! We couldn't be more excited to have you. What can you expect from using our service? We're happy you asked.", // plaintext body
	    html: "<b>" + userName + ", welcome to Recipe Saver!! We couldn't be more excited to have you. What can you expect from using our service? We're happy you asked.</b>" // html body
	};

	// send mail with defined transport object
	transporter.sendMail(mailOptions, function(error, info){
	    if(error){
	        console.log(error);
	    } else {
	        console.log('Message sent: ' + info.response);
	    }
	    transporter.close();
	});
}


function accountRecoveryEmail(userEmail) {
		// create reusable transporter object using SMTP transport
	var transporter = nodemailer.createTransport({
		host: 'smtpout.secureserver.net', 
		port: 465, 
		auth: { 
			user: 'info@recipesaver.net',
			pass: goDaddyPass
		},
		secure: true
	});

	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: 'Recipe Saver <info@recipesaver.net>', // sender address
	    to: userEmail, // list of receivers
	    subject: "Recipe Saver Account Recovery", // Subject line
	    text: "You forgot your password, dummy.", // plaintext body
	    html: "You forgot your password, dummy.</b>" // html body
	};

	// send mail with defined transport object
	transporter.sendMail(mailOptions, function(error, info){
	    if(error){
	        console.log(error);
	    } else {
	        console.log('Message sent: ' + info.response);
	    }
	    transporter.close();
	});
}


function verifyRecaptcha(key, callback) {
	https.get("https://www.google.com/recaptcha/api/siteverify?secret=" + recaptchaSK + "&response=" + key, function(res) {
        var data = "";
        res.on('data', function (chunk) {
            data += chunk.toString();
        });
        res.on('end', function() {
            try {
                var parsedData = JSON.parse(data);
                console.log(parsedData);
                callback(parsedData.success);
            } catch (e) {
                callback(false);
            }
        });
    });
}