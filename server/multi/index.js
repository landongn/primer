/*jslint node: true */
//######################
//## imports
//######################

var redis = require('redis');
var os = require('os');

//#####################

var webserver = require('http').createServer(handler);
var Client = require('./client.js');
var Spy = require('./spy.js');

var io = require('socket.io').listen(webserver);
io.enable('browser client minification'); // send minified client
io.enable('browser client etag'); // apply etag caching logic based on version number
io.set('log level', 1);

//######################
//## Engine is used to handle the multiple clients per single subscription to a redis channel.
//## reuses subscription channels to share messages between any client within a channel
//######################

function Engine() {
	this.roster = {};
	this.channels = {};
	this.server_name = os.hostname();

	this.state = {
		isConnected : false,
		ready: false
	};

	this.connect();
	this.spy = new Spy(this).load();
	return this;
}

/**
 * connects to redis if the engine isn't already connected.
 */
Engine.prototype.connect = function () {
	var self = this;
	if (!this.state.isConnected) {
		this.client = redis.createClient(config().redis.port, config().redis.host);

		this.client.on('ready', function () {
			self.state.ready = true;
			self.state.isConnected = true;
		});
	}
};


/**
 * releases users from the redis store if they need to be purged.
 * @param  {[type]}   server_name [description]
 * @param  {Function} callback    [description]
 * @return {[type]}               [description]
 */	
Engine.prototype.releaseUsers = function (server_name, callback) {
	var self = this;
	this.client.sdiffstore(this.spy.alive, this.spy.alive, this.spy.alive + server_name, function (err, resp) {
		self.client.sdiff(self.spy.alive + server_name, function (err, resp) {
			if (resp) {
				for (var i = 0; i < resp.length; i++) {
					self.spy.emit('cooldown-purge', {'session_id' : resp[i],
													'server' : server_name });
				}
			}
			return callback();
		});
	});
};

Engine.prototype.configure = function () {
	this.spy.restartBots();
	return this;
};

Engine.prototype.start = function () {
	var self = this;

	this.releaseUsers(this.server_name, function () {
		self.attach_socketio();
	});
	function noop() {}
	self.client.hset(self.spy.servers, self.server_name, new Date().getTime());
	setInterval(function () {
		self.client.hset(self.spy.servers, self.server_name, new Date().getTime());
		self.client.hgetall(self.spy.servers, function (err, resp) {
			if (!err && resp) {
				for (var k in resp) {
					var hb = parseInt(resp[k], 10);
					if (!hb || hb < (new Date().getTime() - 6000)) {
						self.releaseUsers(k, noop);
					}
				}
			}
		});
	}, 5000);
};

//######################
//## attach_socketio() sets up callbacks for all connecting clients and routes each call to the proper function
//######################
Engine.prototype.attach_socketio = function () {
	var self = this;
	io.on('connection', function (socket) {
		var c = new Client(self, socket).init();
		self.spy.emit('connect', c);
	});
	webserver.listen(8010);
};


//######################
//## addSubForClient(client, channel) creates a pub/sub channel for a specific channel.
//######################
Engine.prototype.addSubForClient = function (client, channel) {
	var self = this;
	this.createChannel(channel, function () {

		var index = (self.channels[channel].clients.length - 0);
		self.channels[channel].clients.push(client);
		self.channels[channel].client_lookup[client.id] = {
			idx: index,
			name: client.session_id
		};
		client.emit('channel_joined');
	});
};



//######################
//## when a client disconnects, clean the clients array
//######################
Engine.prototype.disconnectClient = function (client) {

	if (typeof this.channels[client.channel] === 'undefined') {
		return;
	}

	if (typeof this.channels[client.channel].client_lookup[client.id] === 'undefined') {
		return; //disconnecting dead session after restart
	}

	var idx = this.channels[client.channel].client_lookup[client.id].idx;
	this.channels[client.channel].clients.splice(idx, 1);
};

//######################
//## add a new subscription channel client into the list of subscriptions
//## redis requires one connection per subscription at all times. you can't reuse them.
//######################
Engine.prototype.createChannel = function (channel_id, callback) {
	if (typeof this.channels[channel_id] !== 'undefined') {
		return callback();
	}
	var self = this;

	this.channels[channel_id] = {
		connection: redis.createClient(config().redis.port, config().redis.host),
		clients: [],
		client_lookup: {}
	};

	this.channels[channel_id].connection.subscribe(channel_id, function (err, resp) {
		callback();
	});

	this.channels[channel_id].connection.on('message', function (channel, data) {
		var msgjson = JSON.parse(data);
		for (var i = 0; i < self.channels[channel_id].clients.length; i++) {
			self.channels[channel_id].clients[i].socket.emit(msgjson.messageType, msgjson);
		}
	});
};


Engine.prototype.broadcast = function (data) {
	this.client.publish(data.channel, JSON.stringify(data));
};


module.exports = Engine;