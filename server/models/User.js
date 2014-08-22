var User = {
	initializeModel: function (bookshelf) {
		return bookshelf.Model.extend({
			tableName: 'users'
		});
	}
};

module.exports = User;