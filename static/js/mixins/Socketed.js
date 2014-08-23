App.Socketed = Ember.Mixin.create({

	init: function () {
		this._super();

		// create the socket io connection
		var socket = io.connect('http://onlyfunthings.com');
		socket.on('connection', function (client) {
			console.log('connected');
		});
	}

});