App.BaseLevel = Ember.Object.extend({

	init: function () {
		if (this.camera === null) {
			Phaser.State.call(this);
		}
	},

	preload: function () {},
	create: function () {},
	update: function () {},
	render: function () {},
	pause: function () {},
	resume: function () {},
	shutdown: function () {}

});