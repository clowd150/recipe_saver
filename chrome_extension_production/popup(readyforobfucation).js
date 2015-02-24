//var mysite = "http://localhost:3000";
var mysite = "http://www.recipesaver.net";


function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };
  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    console.log(tab.url);
    var url = tab.url;
    console.assert(typeof url == 'string', 'tab.url should be a string');
    callback(url);
  });
}

// Whenever the DOM is loaded for this window, run this function
$(document).ready(function() {
  getCurrentTabUrl(function(url) {
  	$(document).on('click', "#logTog", function() {
  		$("#loginForm").toggle();
  	});

  	var credentials;
  	var encrypted;

  	$(document).on('click', "#login", function(e) {
  		e.preventDefault();
  		$(this).prop('value', 'Logging in...');
  		var princess = $("#princess").val();
  		var bollocks = $("#bollocks").val();
  		encrypted = CryptoJS.Rabbit.encrypt(bollocks, "saltine");
  		console.log(encrypted);
  		credentials = {"princess": princess, "bollocks": encrypted};
  		chrome.storage.sync.set(credentials, function() {
    	    console.log('Credentials saved.');

    	    //New Stuff
    	    chrome.storage.sync.get(credentials, function(result) {
    	    	var cracker = "saltine";
       			var princess = result.princess;
       			var decrypted = CryptoJS.Rabbit.decrypt(result.bollocks, cracker).toString(CryptoJS.enc.Utf8);
       			var bollocks = decrypted;
	        	$.ajax({
	        		type: "POST",
	        		crossDomain: true,
	        		url: mysite + "/chromeLogin",
	        		data: "princess=" + princess + "&bollocks=" + bollocks,
	        		error: function(XMLHttpRequest, textStatus, errorThrown) {
	        			$("#signInMessage").show();
	        			$("#signInMessage").html("Incorrect email or password.");
	        			$("#login").prop('value', 'Log In');
        				//alert("Wrong username or password."); 
    				},
    				success: function(data) {
    					$("#signInMessage").show();
    					$("#signInMessage").html("Welcome, " + data.username + ".");
    					$("#login").prop('value', 'Log In');
    					$("#loginForm").toggle();
    					//alert("You are now logged in.")
    				}
	    		});
			});
    	});
  	});

  	$(document).on('click', "#inspect", function(e) {
  		// chrome.storage.sync.remove("bollocks", function() {
  		//  	console.log("Old stuff removed.");
  		// });
		chrome.storage.sync.get(credentials, function(result) {
			console.log(result);
		});
	});

    chrome.tabs.getSelected(null, function(tab) { //<-- "tab" has all the information
    	var cracker = "saltine";
    	var title = tab.title;
    	$("#recipeName").val(title).select();
    	$("#url").val(url);

    	$(document).on('click', "#saveRecipe", function(e) {
       		e.preventDefault();
       		$("#saveRecipe").prop('value', 'Saving...');
       		var recipe = $("#recipeName").val();
       		var newURL = $("#url").val();
       		var notes = $("#notes").val();
       		var tags = $("#tags").val();
	       	chrome.storage.sync.get(credentials, function(result) {
	       		if (jQuery.isEmptyObject(result)) {
	       			$("#signInMessage").show();
	       			$("#signInMessage").html("Please log in first.");
    	    		$("#loginForm").toggle();
	   			 } else {
	       			var princess = result.princess;
	       			var decrypted = CryptoJS.Rabbit.decrypt(result.bollocks, cracker).toString(CryptoJS.enc.Utf8);
	       			var bollocks = decrypted;
		        	$.ajax({
		        		type: "POST",
		        		crossDomain: true,
		        		url: mysite + "/chromepost",
		        		data: "princess=" + princess + "&bollocks=" + bollocks +"&recipe=" + recipe + "&url=" + newURL + "&notes=" + notes + "&tags=" + tags,
		        		error: function() {
		        			$("#signInMessage").show();
		        			$("#signInMessage").html("Sorry - something went wrong. Try logging in again.");
		        			//alert("Sorry - something went wrong. Try logging in again.");
		        			$("#saveRecipe").prop('value', 'Save Recipe');
		        			$("#loginForm").toggle();
		        		},
		        		success: function() {
		        			$("#chromeForm").hide();
		    				$("#postedMessage").show();
		        		}
		    		});
		    	}
			});
    	});
    });
  });
});


