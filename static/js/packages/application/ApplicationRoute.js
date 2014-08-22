App.ApplicationRoute = Ember.Route.extend({
	
	model: function (params) {

	},

	setupController: function (controller, model) {

	},

	renderTemplate: function () {
		this.render();

		this.render('stage', {
			into: 'application',
			outlet: 'stage'
		});

		this.render('menu', {
			into: 'application',
			outlet: 'menu'
		});
	}
});
