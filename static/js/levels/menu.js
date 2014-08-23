App.StartScreenLevel = App.BaseLevel.extend(App.Socketed, {

	preload: function () {
		this.game.physics.startSystem(Phaser.Physics.P2JS);

		this.game.load.image('player', '/static/img/entities/player.png');
	},
	create: function () {
		this.game.add.sprite(200, 200, 'player');
	},
	update: function () {},
	render: function () {},
	pause: function () {},
	resume: function () {},
	shutdown: function () {}

});