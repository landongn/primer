var App = window.App = Ember.Application.create({
	LOG_TRANSITIONS: true,

	ready: function () {
		var Game = App.Game;

		var startScreen = App.StartScreenLevel.create();
		App.Game.engine.state.add('start', startScreen);
		App.Game.engine.state.start('start');
	}
});


require('js/mixins/*');
require('js/entities/*');
require('js/levels/*');
require('js/models/*');
require('js/components/*');
require('js/helpers/*');
require('js/packages/*/*');
require('js/router');
