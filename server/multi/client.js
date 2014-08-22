/*jslint node: true */
//######################
//## Client - a single socket.io client
//######################

var Emitter = require('events').EventEmitter;
var util = require('util');

function Client(engine, socket) {
	this.PLAYER = 'p';
	this.SPEC = 's';
	this.DISC = 'd';

	this.socket = socket;
	this.channel = null;
	this.session_id = null;
	this.username = null;
	this.id = '' + socket.id;
	this.__engine = engine;
	this.userdata = {};
	this.status = this.DISC;
	this.max_users = 8;
	this.alive = engine.spy.alive;
	this.server_name = engine.server_name;
	this.max_play_tries = 10;

	return this;
}

util.inherits(Client, Emitter);

Client.prototype.init = function () {
	var self = this;

	//######################
	this.socket.on('ident', function (message) {
		if (!message.session_id) {
			return;
		}

		var session_id = message.session_id.toString().replace(/\W-/g, '');
		var username = message.username;

		if (!username) {
			username = '';
		} else {
			username = username.replace(/\W/g, '');
		}

		self.socket.session_id = session_id;
		self.session_id = session_id;
		self.username = username;

		self.__engine.client.hgetall(self.session_id, function (err, ud) {
			if (ud !== null && ud.channel !== null) {
				self.userdata = ud;
				self.status = ud.status;
				self.channel = ud.channel;
				self.__engine.client.hmset(self.session_id, {'server' : self.server_name});
				if (self.userdata.status === self.PLAYER) {
					self.emit('resume_play');
				} else {
					self.status = self.SPEC;
					self.emit('resume_spec');
				}
			} else {
				//if no user data is found, create it and push into the users hash
				self.userdata = {
					"session_id": self.session_id,
					"username": self.username,
					"id": self.socket.id,
					"status" : self.SPEC,
					"server" : self.server_name,
				};
				self.channel = null;
				self.status = self.SPEC;
				self.__engine.client.hmset(self.session_id, self.userdata);
				self.emit('become_spec');
			}
		});

	});

	this.on("resume_play", function () {
		// The user may have changed servers
		self.__engine.client.sadd(self.alive, self.session_id);
		self.__engine.client.sadd(self.alive + self.server_name, self.session_id);
		self.socket.emit('became_player', {'channel': self.channel});
		self.emit('channel_assigned');
		return;
	});

	this.on("resume_spec", function () {
		self.__engine.client.hmset(self.session_id, {'status': self.status,
													'channel': self.channel});
		// expire specators in 60 mins so we don't
		// have to track them like we do players
		self.__engine.client.expire(self.session_id, 60 * 60);

		self.socket.emit('became_spectator', {'channel': self.channel});
		self.socket.emit('assigned_to_channel', {channel: self.channel});
		self.emit('channel_assigned');
	});

	//######################
	this.on('become_spec', function () {
		var args = [self.__engine.spy.master_tag, self.max_users - 1, '-inf', 'LIMIT', 0, 1];
		self.__engine.client.zrevrangebyscore(args, function (err, data) {
			if (data && data.length > 0) {
				self.channel = data[0];
				self.emit('resume_spec');
			} else {
				self.emit('master_server_empty');
			}
		});
	});

	//######################
	this.on('master_server_empty', function (count) {
		self.__engine.spy.emit('add-channel');
		self.channel = null;
		self.__engine.client.del(self.session_id);
		// in 1 sec tell them to try again.
		setTimeout(function () {
			self.socket.emit("ident");
		}, 1000);
	});

	//######################
	this.on('channel_assigned', function () {
		// This happens 1st so that no new moves are missed.
		self.__engine.addSubForClient(self, self.channel);
	});

	this.on('channel_joined', function () {
		self.__engine.client.smembers(self.channel, function (err, other_users) {
			if (other_users.length) {
				self.emit('channel_update', {roster: other_users});
			} else {
				self.emit('channel_update', {roster: []});
			}
		});
	});

	//######################
	this.on('channel_update', function (data) {
		self.length_of_updating_users = data.roster.length;

		var iterator = 0;
		var roster = {};

		if (self.length_of_updating_users < 3) {
			self.__engine.spy.emit('spawn-bot', self.channel);
			if (self.length_of_updating_users === 0) {
				self.emit("user_roster_finished", roster);
			}
		}

		for (var i = 0; i < data.roster.length; i++) {
			roster[data.roster[i]] = {'parts': []};
		}

		function processUser(index, error, parts) {
			if (iterator === self.length_of_updating_users) {
				self.emit('user_roster_finished', roster);
			} else {
				roster[index].parts = parts;
				self.__engine.client.hget(index, "username", function (err, resp) {
					iterator++;
					if (!err && resp) {
						roster[index].username = resp;
					} else {
						roster[index].username = "";
					}
					if (iterator === self.length_of_updating_users) {
						self.emit("user_roster_finished", roster);
					}
				});
			}
		}

		data.roster.forEach(function (user) {
			self.__engine.client.smembers(user + '_parts', function (error, parts) {
				processUser(user, error, parts);
			});
		});
	});


	//######################
	this.on('user_roster_finished', function (data) {
		self.socket.emit('channel_roster', data);
	});

	this.on('play_channel', function (options) {
		var channel = options.shift();
		self.__engine.client.zincrby(self.__engine.spy.master_tag, 1, channel, function (err, resp) {
			if (!err && resp <= self.max_users) {

				self.status = self.PLAYER;
				self.play_tries = 0;
				self.__engine.client.hmset(self.session_id,
					{'status': self.status, 'channel': channel});
				self.__engine.client.persist(self.session_id);
				self.__engine.client.sadd(channel, self.session_id, function (err, resp) {
					if (channel !== self.channel) {
						self.channel = channel;
						self.emit('channel_assigned');
					}

					self.socket.emit('became_player', {'channel': channel});
					self.socket.emit('assigned_to_channel', {channel: channel});

					self.__engine.broadcast({
						messageType: "join",
						session_id: self.session_id,
						username: self.username,
						channel: channel
					});
				});
				self.__engine.client.sadd(self.alive, self.session_id);
				self.__engine.client.sadd(self.alive + self.server_name, self.session_id);

			} else {
				self.__engine.client.zincrby(self.__engine.spy.master_tag, -1, channel, function (err, r) {
					self.emit('find_channel', options);
				});
			}
		});
	});

	this.on('find_channel', function (options) {
		if (options && options.length > 0) {
			self.emit('play_channel', options);
		} else {
			self.emit('master_server_empty');
		}
	});

	//######################
	this.socket.on('request_seat', function () {
		if (!self.channel || !self.session_id) {
			self.socket.disconnect();
			return;
		}

        self.__engine.client.exists(self.session_id, function (err, exists) {
			if (!exists) {
	            // The key doesn't exists, they need to iden again
	            self.socket.emit("ident");
                return;
			} else {
		        var options = [self.channel];
		        self.__engine.client.sismember(self.alive, self.session_id,
			        function (err, resp) {
				        if (!err && resp === 0) {
					        // Get a list of open channels
					        var args = [self.__engine.spy.master_tag, self.max_users - 1, '-inf', 'LIMIT', 0, self.max_play_tries];
					        self.__engine.client.zrevrangebyscore(args, function (err, data) {
						        if (data && data.length > 0) {
							        options = [self.channel].concat(data);
						        }
						        self.emit('find_channel', options);
					        });

				        } else {
					        self.socket.emit('not_allowed');
					        self.socket.disconnect();
				        }
			        });
            }
		});
    });

	//######################
	this.socket.on('add_track', function (message) {
		if (!self.channel || self.status !== self.PLAYER) {
			self.socket.disconnect();
			return;
		}
		var p = {message: message, socket: self.socket};
		p.channel = self.channel;
		p.session_id = self.socket.session_id;
		self.__engine.spy.emit('add_track', p);
	});

	//######################
	this.socket.on('remove_track', function (message) {
		if (!self.channel || self.status !== self.PLAYER) {
			self.socket.disconnect();
			return;
		}
		message.channel = self.channel;
		message.session_id = self.socket.session_id;
		self.__engine.spy.emit('remove_track', message);
	});

	//######################
	this.socket.on('clear_tracks', function (message) {
		if (!self.channel || self.status !== self.PLAYER) {
			self.socket.disconnect();
			return;
		}
		self.__engine.client.sdiffstore(self.channel + '_parts', self.channel + '_parts', self.session_id + '_parts', function (err, resp) {
			self.__engine.client.del(self.session_id + '_parts', function (err, data) {
				self.__engine.broadcast({
					messageType: "clear_tracks",
					session_id: self.session_id,
					channel: self.channel
				});
			});
		});
	});

	//######################
	this.socket.on('sound_horn', function (message) {
		if (!self.channel || self.status !== self.PLAYER) {
			self.socket.disconnect();
			return;
		}
		self.__engine.broadcast({
			messageType: "sound_horn",
			session_id: self.session_id,
			channel: self.channel
		});
	});

	//######################
	this.socket.on('part', function (message) {
		self.socket.disconnect();
	});

	//######################
	this.socket.on('disconnect', function () {
		self.__engine.spy.emit('disconnect', self);
	});

	this.socket.emit('ident');

	return this;
};

module.exports = Client;