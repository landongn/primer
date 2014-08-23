App.Socketed = Ember.Mixin.create({

	init: function () {
		this._super();

		var that = this;

		// create the socket io connection
		var socket = io.connect('http://onlyfunthings.com');
		socket.on('newPlayer', function (data) {
			that.socketMessage('newPlayer', data);
		});

		socket.on('playerMoved', function (data) {
			that.socketMessage('playerMoved', data);
		});
	},

	socketMessage: function (event, data) {}

});