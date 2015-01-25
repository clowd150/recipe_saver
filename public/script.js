$(document).ready(function() {
	// Post Recipe
	$(document).on('click', '#submitRecipe', function(e) {
		e.preventDefault();
		$.ajax({
		    type: "POST",
		    url: "/profile",
		    data: $('#recipeEntry').serialize()
		}).done(function() {
			$.get( "/recipelist", function(data) {
				var response = $(data);
		    	generatedId = response.find('input').val();
		    	generatedIdParent = response.find('input').parent();
				$('.result').html(generatedIdParent);
				resetNotesFormat();
				$('.notes').hide();
			});
		});
		$('#recipeEntry')[0].reset();
		$('#notify').hide().html("Recipe posted! :-)").fadeIn(1000);
		setTimeout(function() {
			$('#notify').fadeOut(1000);
		}, 3500);
		setTimeout(function() {
			$('#notify').fadeIn();
			$('#notify').html("&nbsp;");
		}, 4500);
	});

	// Hide Notes on load
	$('.notes').hide();

	// Toggle Menu
	$(document).on('click', '.edit', function(e) {
		e.preventDefault();
		var menu = $(this).parent().prev();
		menu.toggle();

		$(document).mouseup(function (e) {
		    var container = menu;
		    if (!container.is(e.target) // if the target of the click isn't the container...
		        && container.has(e.target).length === 0) // ... nor a descendant of the container
		    {
		        container.hide();
		    }
		});
	});


	// Edit Recipe Name
	$(document).on('click', '.editName', function(e) {
		e.preventDefault();
		$('.menu').hide();
		var currentRecipe = $(this).parent().parent();

		//Don't include var here
		nameClone = $(this).parent().next().html();
		console.log(nameClone);

		var name = $(this).parent().next().find('b');
		var namevalue = name.html();
		console.log("First: " + namevalue);
		$('.rName').find('img').unwrap();
		$('.editImage').replaceWith("<span class='space'>&nbsp;&nbsp;&nbsp;&nbsp;<span>");

		var nameParent = name.parent();
		nameParent.html("&nbsp;&nbsp;&nbsp;&nbsp;<input id='newname' type='text' name='newname'>");
		$('#newname').val(namevalue);
		$('#newname').select();

		var recordID = $(this).parent().prev().val();
		console.log(recordID);

		$(document).mouseup(function(event){
		    var target = $("#newname");
		    if (!target.is(event.target) && target.is(":visible")) {
		       target.parent().html(nameClone);
		       $('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");
		    }
		});

		$('#newname').keydown(function (e){
			if(e.keyCode == 13) {
				$.ajax({
			        url: "/updateName/" + recordID,
			        type: "POST",
			        data: $('#newname').serialize()
			    }).done(function() {
			    	$.get( "/recipelist", function(data) {
			    		var response = $(data);
			    		var returnID = response.find("#" + recordID);
			    		//alert(returnID.val());
			    		var parentRecipe = returnID.parent().html();
						currentRecipe.html(parentRecipe);
						$('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");
						resetNotesFormat();
						$('.notes').hide();
					});
			    });
			}
		});
	});

	// Edit URL
	$(document).on('click', '.editUrl', function(e) {
		e.preventDefault();
		var currentRecipe = $(this).parent().parent();
		$('.menu').hide();
		$('.rName').find('img').unwrap();
		$('.editImage').replaceWith("<span class='space'>&nbsp;&nbsp;&nbsp;&nbsp;<span>");

		$('.editImage').hide();
		var editButtonClone = $(this).parent().next().find('a')//.html();
		//editButton = $(this).parent().next().find('a');
		//editButton.replaceWith("<img src='space.png'>");
		//editButtonClone.hide();

		//Don't include var here
		urlClone = $(this).parent().next().next().html();
		urlClone2 =  $.trim(urlClone);
		console.log(urlClone2);
		
		var urlValue = $(this).parent().next().next().text();
		var urlValue2 = $.trim(urlValue);
		console.log("Url Value: " + urlValue2);

		var urlParent = $(this).parent().next().next();
		urlParent.html("<input id='newurl' type='text' name='newurl'>");
		$('#newurl').val(urlValue2);
		$('#newurl').select();
		
		var recordID = $(this).parent().prev().val();
		console.log(recordID);

		$(document).mouseup(function(event){
		    var target = $("#newurl");
		    if (!target.is(event.target) && target.is(":visible")) {
		       target.parent().html(urlClone2);
		       $('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");
		    }
		});
	
		$('#newurl').keydown(function (e){
			if(e.keyCode == 13) {
				$.ajax({
			        url: "/updateUrl/" + recordID,
			        type: "POST",
			        data: $('#newurl').serialize()
			    }).done(function() {
			    	$.get( "/recipelist", function(data) {
			    		var response = $(data);
			    		var returnID = response.find("#" + recordID);
			    		//alert(returnID.val());
			    		var parentRecipe = returnID.parent().html();
						currentRecipe.html(parentRecipe);
						$('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");

						// RELOAD NOTES CORRECTLY
						var parentRecipe = returnID.parent();
						var newFormattedRecipe = $.trim(parentRecipe.find('.notes').html())
						newFormattedRecipe = newFormattedRecipe.replace(/\n\r?/g, '<br>');
						currentRecipe.find('.notes').html(newFormattedRecipe);
						$('.notes').hide();
					});
			    });
			}
		});
		
	});
	
	// Edit Notes
	var noteRecordID;
	var currentNoteRecipe;
	var noteClone;
	$(document).on('click', '.editNotes', function(e) {
		//var noteRecordID;
		e.preventDefault();
		currentNoteRecipe = $(this).parent().parent();
		$('.menu').hide();
		$('.rName').find('img').unwrap();

		//Don't include var here
		noteClone = $(this).parent().next().next().next().html();
		var targetSpot = $(this).parent().next().next().next().find("*").next();
		console.info("target class: " + targetSpot.attr('class'));
		console.info('Note Clone: ' + noteClone +"\nNoteClone length: " + noteClone.length);

		console.log("NOTECLONE CLASS: " + $(this).parent().next().next().next().attr('class'));
		if ($(this).parent().next().next().next().attr('class') == "existingNote") {
			var noteSection = $(this).parent().next().next().next().next();
			
			if (!noteSection.is(":visible")) {
				noteSection.toggle();
			}

			$('.editImage').replaceWith("<span class='space'>&nbsp;&nbsp;&nbsp;&nbsp;<span>");

			var noteValue = $(this).parent().next().next().next().find("*").next().html();
			console.log("Note Value: " + noteValue);
			var noteValue2 = noteValue.replace(/<br>/g, '\r');
			console.log("Note Value2: " + noteValue2);

			var noteParent = $(this).parent().next().next().next();
			console.log("noteParent: " + noteParent.html());
			noteParent.html("<textarea id='newnote' name='newnote'></textarea><button id='newNoteSubmit'>Save</button><button id='cancel'>Cancel</button>");
			$('#newnote').val(noteValue2);
			
			noteRecordID = $(this).parent().prev().val();
			console.log("NOTERECORDID: " + noteRecordID);

		} else {
			console.warn('ELSE BLCOK');
			$('.editImage').replaceWith("<span class='space'>&nbsp;&nbsp;&nbsp;&nbsp;<span>");
			var noteValue = $(this).parent().next().next().next().find("*").next().html();
			var noteParent = $(this).parent().next().next().next();
			noteParent.html("<textarea id='newnote' name='newnote'></textarea><button id='newNoteSubmit2'>Save</button><button id='cancel'>Cancel</button>");
			//$('#newnote').val(noteValue);

			noteRecordID = $(this).parent().prev().val();
			console.log("noteRecordID: " + noteRecordID);
		}
	});

	// Update existing note
	$(document).on('click', '#newNoteSubmit', function(e) {
		e.preventDefault();
		$.ajax({
	        url: "/updateNote/" + noteRecordID,
	        type: "POST",
	        data: $('#newnote').serialize()
	    }).done(function() {
	    	$.get( "/recipelist", function(data) {
	    		var response = $(data);
	    		var returnID = response.find("#" + noteRecordID);
	    		//alert(returnID.val());
	    		//var parentRecipe = returnID.parent().html();
				var parentRecipe = returnID.parent();
				var newFormattedRecipe = $.trim(parentRecipe.find('.notes').html())
				newFormattedRecipe = newFormattedRecipe.replace(/\n\r?/g, '<br>');
				if (newFormattedRecipe.length >= 1) {
					currentNoteRecipe.find('.existingNote').html("<div class='noteIndicator'><a href='#' class='noteToggler'>Notes</a></div><div class='notes'>" + newFormattedRecipe + "</div>");
					console.log("CR: " + currentNoteRecipe.html());
					console.log("LOOKING" + currentNoteRecipe.find('.notes').html());
				} else {
					currentNoteRecipe.find('.existingNote').replaceWith("<div class='alternative'><div class='blank'></div><div class='noNotes'></div></div>");
				}
				$('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");
				existingNote = false;
			});
	    });
	});

	// Submit new note
	$(document).on('click', '#newNoteSubmit2', function(e) {
		e.preventDefault();
		$.ajax({
	        url: "/updateNote/" + noteRecordID,
	        type: "POST",
	        data: $('#newnote').serialize()
	    }).done(function() {
	    	$.get( "/recipelist", function(data) {
	    		var response = $(data);
	    		var returnID = response.find("#" + noteRecordID);
	    		//alert(returnID.val());
	    		//var parentRecipe = returnID.parent().html();
				var parentRecipe = returnID.parent();
				var newFormattedRecipe = $.trim(parentRecipe.find('.notes').html())
				newFormattedRecipe = newFormattedRecipe.replace(/\n\r?/g, '<br>');
	    		console.warn(newFormattedRecipe);

	    		console.log("Current RECIPE: "  + currentNoteRecipe.html());
				currentNoteRecipe.find('.alternative').replaceWith("<div class='existingNote'><div class='noteIndicator'><a href='#' class='noteToggler'>Notes</a></div><div class='notes'>" + newFormattedRecipe + "</div></div>");

				$('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");
			});
	    });
	});  

	// Note Cancel Button
	$(document).on('click', '#cancel', function(e) {
		e.preventDefault();
		$('.space').replaceWith("<a class='edit' href='#'><img src='edit.png' class='editImage'></a>");
		var target = $("#newnote").parent();
		console.log(target.attr('class'));
		target.html(noteClone);
	});

	// Delete Recipe
	$(document).on('click', '.delete', function(e) {
		e.preventDefault();
		var currentRecipe = $(this).parent().parent();
		$('.menu').hide();

		var recordID = $(this).parent().prev().val();
		console.log("Deleted Record ID: " + recordID);
		var confirmation = confirm('Are you sure you want to delete this recipe?');
		if (confirmation) {
		   $.ajax({
		        url: "/profile/delete/" + recordID,
		        type: "GET"
		    }).done(function() {
				currentRecipe.remove();
			});
		} else {
			return;
		}
	});


	// Hover Color
	$(document).on('mouseenter', '.rName', function() {
		$(this).animate({"backgroundColor": "#effbfc"}, 120);
		$(this).next().animate({"backgroundColor": "#effbfc"}, 120);
	});
	$(document).on('mouseout', '.rName', function() {
		$(this).animate({"backgroundColor": "white"}, 170);
		$(this).next().animate({"backgroundColor": "white"}, 170);
	});

	// Toggle Notes
	$(document).on('click', '.noteToggler', function(e) {
		e.preventDefault();
		var note = $(this).parent().next();
		note.toggle();
	});


	// Implement line breaks in notes field
	resetNotesFormat();
	function resetNotesFormat() {
		$(".notes").each(function(index) {
			var noteText = $.trim($(this).html());
			var noteTextFormated = noteText.replace(/\n\r?/g, '<br>');
			$(this).html(noteTextFormated);
		});
	}

	// Sort A - Z
	$(document).on('click', '#sortAZ', function(e) {
		e.preventDefault();
		$.get( "/profile/sortAZ", function() {
		}).done(function() {
			$.get( "/recipelist", function(data) {
				$('.result').html(data);
				$('.notes').hide();
			});
		});
	});

	// Sort Z - A
	$(document).on('click', '#sortZA', function(e) {
		e.preventDefault();
		$.get( "/profile/sortZA", function() {
		}).done(function() {
			$.get( "/recipelist", function(data) {
				$('.result').html(data);
				$('.notes').hide();
			});
		});
	});

	// Sort by Tag
	$(document).on('click', '.aTag', function(e) {
		e.preventDefault();
		var tagName = $(this).text();
		console.log("TAGNAME: " + tagName);
	   $.ajax({
	        url: "/profile/tags/" + tagName,
	        type: "GET"
	    }).done(function() {

		});
	});


});
