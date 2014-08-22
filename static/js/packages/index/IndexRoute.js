App.IndexRoute = Ember.Route.extend({
	
	renderTemplate: function () {
		this.render('index', {
			into: 'application',
			outlet: 'dialog'
		});
	}
});
