db.recipes.aggregate([
	{$group:
		{
			_id: {
				"username": "$user_id"
			},
			num_recipes: {$sum:1}
		}
	}, 
	{$sort:
		{
			num_recipes: -1
		}
	}
])