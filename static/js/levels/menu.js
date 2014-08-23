App.StartScreenLevel = App.BaseLevel.extend(App.Socketed, {


	player: null,
	bg1: null,
	bg2: null,

	preload: function () {
		this.game.physics.startSystem(Phaser.Physics.P2JS);

		this.game.load.image('player', '/static/img/entities/player.png');
		this.game.load.image('bg1', '/static/img/bg1.png');
		this.game.load.image('bg2', '/static/img/bg2.png');
	},
	create: function () {
		this.bg1 = this.game.add.sprite(0, 0, 'bg1');
		this.player = this.game.add.sprite(200, 200, 'player');
		this.player.scale.set(1);
		this.game.physics.p2.enable(this.player);

		this.player.body.setCircle(28);
		this.player.body.collideWorldBounds = true;


	},
	update: function () {
		App.Game.statsStart();

		
	},
	render: function () {
		App.Game.statsEnd();
	},
	pause: function () {},
	resume: function () {},
	shutdown: function () {},


	socketMessage: function (event, data) {
		console.log('message from socket!', data);
	}

});