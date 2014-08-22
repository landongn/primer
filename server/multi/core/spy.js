/*jslint node: true */
//######################
//## like gamespy, but for trains.
//######################

var redis = require('redis');
var Emitter = require('events').EventEmitter;
var config = require('../../conf')();
var util = require('util');
var Bot = require('./bot.js');
var email = require('nodemailer');

email.SMTP = config.smtp;


function Spy(engine) {
	'use strict';
	this.channels = {};
	this.engine = engine;
	this.bots = {};
	this.channel_count = 20;
	this.master_tag = 'LIONEL_MASTER';
	this.tag = 'LIONEL_';
	this.servers = 'SERVERS';
	this.alive = 'ALIVE';
	this.client = null; //redis client
	this.max_moves = 1000;
}

util.inherits(Spy, Emitter);


Spy.prototype.load = function () {

	var self = this;

	this.interval = setInterval(function () {
		self.update();
	}, 15000);

	this.client = redis.createClient(config.redis.port, config.redis.host);

	this.client.hdel(this.servers, self.engine.server_name);

	//######################
	//## creates n channels on warm up (this.channel_count)
	//######################
	this.client.zcard(this.master_tag, function (err, data) {
		if (!err && data === 0) {
			for (var i = 0; i < self.channel_count; i++) {
				self.client.zadd(self.master_tag, 0, self.tag + i);
			}
		}
	});

	this.on('add-channel', function () {
		// Add a new channel if the we don't have any open ones
		var args = [self.master_tag, 1, '-inf', 'LIMIT', 0, 1];
		self.client.zrevrangebyscore(args, function (err, data) {
			if (data && data.length === 0) {
				self.client.zcard(self.master_tag, function (err, count) {
					var i = count + 1;
					self.client.zincrby(self.master_tag, 0, self.tag + i, function (err, score) {
						if (score < 1) {
							var d = {
								to : config.errors.to,
								sender : config.errors.from,
								subject : config.errors.subject,
								body: "No free rooms. Adding one now at " + i
							};
							email.send_mail(d, function (err, result) {
								if (err) {
									console.log(err);
								}
							});
						}
					});
				});
			}
		});
	});

	//######################
	this.on('bot-cleanup', function (data) {
		//immediately clean up the old bot data.
		self.client.sdiffstore(data.channel + '_parts', data.channel + '_parts', data.username + '_parts', function (err, resp) {
			self.client.del(data.username + '_parts');
			self.client.del(data.username);
			self.client.srem(data.channel, data.username);

			self.engine.broadcast({
				messageType: "part",
				username: data.username,
				session_id: data.username,
				channel: data.channel
			});
		});
	});

	this.on('bot-join', function (data) {
		self.client.hmset(data.username, {'channel': data.channel, 'username': data.username, 'status': "p", 'bot': 'yes' });
		self.client.sadd(data.channel, data.username);
		self.engine.broadcast({
			messageType: "join",
			username: data.username,
			channel: data.channel,
			session_id: data.username
		});

		for (var i = 0; i < 6; i++) {
			data.update();
		}
	});

	this.on('spawn-bot', function (channel) {
		self.client.sismember(channel, 'bort_' + channel, function (err, resp) {
			if (!err && resp === 0) {
				self.engine.createChannel(channel, function () {
					self.bots[channel] = new Bot(self).spawn('bort_' + channel, channel);
				});
			}
		});
	});

	this.on('bot-death', function (data) {
		data.destroy();
		delete self.bots[data.channel];
	});

	//######################
	this.on('disconnect', function (data) {
		if (!data.session_id) {
			return;
		}

		self.engine.disconnectClient(data);
		//update redis roster, add client to the cooldown, then remove.
		self.client.srem(self.alive, data.session_id);
		self.emit('cooldown-purge', data);
	});
	//######################

	this.on('cooldown-purge', function (data) {
		setTimeout(function () {
			self.client.sismember(self.alive, data.session_id, function (err, exists) {
				if (!exists) {
					self.removeUserFromRedis(data);
				} //noop otherwise
			});
		}, 60000);
	});

	this.on('leave-room', function (user) {
		self.client.sdiffstore(user.channel + '_parts', user.channel + '_parts', user.session_id + '_parts', function (err, resp) {
			self.client.srem(user.channel, user.session_id);
			self.client.del(user.session_id + "_parts");
			self.client.zincrby(self.master_tag, -1, user.channel, function (err, resp) {
				if (!err && resp < 3) {
					self.emit('spawn-bot', user.channel);
				}
			});

			self.client.hget(user.session_id, 'total_parts', function (err, resp) {
				var json = JSON.stringify({'user': user.session_id, 'parts': resp});
				if (!err && resp !== null) {
					self.client.lpush(config.analyticsKey, json);
				}
				self.client.del(user.session_id);
			});
		});
	});

	//######################
	this.on('part', function (data) {
		var disconnectPayload = {
			messageType: 'part',
			channel: data.channel,
			session_id: data.session_id
		};

		self.engine.broadcast(disconnectPayload);
	});


	// SHOULDN"T BE ABLE TO move in any channel
	//######################
	this.on('add_track', function (payload) {
		//make sure track isn't in redis
		self.client.sismember(payload.channel + '_parts', payload.message.index, function (err, resp) {
			if (!err && resp === 0) {
				self.client.scard(payload.session_id + '_parts', function (err, resp) {
					if (!err && resp < self.max_moves) {
						self.client.sadd(payload.channel + '_parts', payload.message.index);
						self.client.sadd(payload.session_id + '_parts', payload.message.index);
						self.client.hincrby(payload.session_id, 'total_parts', 1);

						self.engine.broadcast({
							messageType: 'add_track',
							channel: payload.channel,
							session_id: payload.session_id,
							index: payload.message.index
						});
					} else {
						payload.socket.emit('too_many_tracks', payload.message.index);
					}
				});
			} else if (resp === 1) {
				payload.socket.emit('add_track_failed', payload.message.index);
			}
		});
	});

	//######################
	this.on('remove_track', function (message) {
		//make sure track already in redis
		self.client.sismember(message.channel + '_parts', message.index, function (err, resp) {
			if (!err && resp !== null) {
				self.client.sismember(message.session_id + '_parts', message.index, function (err, exists) {
					if (exists === 0 || exists === null) {
						return;
					}
					self.client.srem(message.channel + '_parts', message.index);
					self.client.srem(message.session_id + '_parts', message.index);
					self.client.hincrby(message.session_id, 'total_parts', -1);

					self.engine.broadcast({
						messageType: 'remove_track',
						channel: message.channel,
						session_id: message.session_id,
						index: message.index
					});
				});
			}
		});
	});
	return this;
};


//######################
//## Delete any bots that aren't active
//## in 1 min. Prevents a restarting server from
//## affecting other servers bots.
//######################
Spy.prototype.restartBots = function () {
	var self = this;
	function restart(key) {
		var bot = 'bort_' + key;
		self.client.hmset(bot, {'alive': 'no'});
		setTimeout(function () {
			self.client.hget(bot, 'alive', function (ierr, iresp) {
				if (iresp !== "yes") {
					self.emit('bot-cleanup', { 'channel' : key, 'username' : bot });
					// respawn in 15 secs
					setTimeout(function () {
						self.emit('spawn-bot', key);
					}, 2000);
				}
			});
		}, 60000);
	}
	this.client.zrange(self.master_tag, 0, -1, function (err, resp) {
		if (!err && resp.length !== 0) {
			for (var x = 0; x < resp.length; x++) {
				restart(resp[x]);
			}
		}
	});
};

//######################
//## runs every 5s
//## if a bot should die, this is where it is killed.
//######################
Spy.prototype.update = function () {
	var self = this;

	function checkBot(key) {
		self.client.zscore(self.master_tag, key, function (err, resp) {
			var bot = self.bots[key];
			if (typeof bot !== 'undefined') {
				if (err || resp === null || resp > 2) {
					self.emit('bot-death', bot);
				} else if (bot.parts.length >= 100) {
					self.emit('bot-death', bot);
					// respawn in 15 secs
					setTimeout(function () {
						self.emit('spawn-bot', key);
					}, 15000);
				}
			}
		});
	}

	for (var key in self.bots) {
		checkBot(key);
	}
};


Spy.prototype.removeUserFromRedis = function (user) {
	var self = this;
	self.client.srem(self.alive, user.session_id);
	var server = user.server;
	if (!user.server) {
		server = self.engine.server_name;
	}
	self.client.srem(self.alive + server, user.session_id);
	this.client.hgetall(user.session_id, function (err, resp) {
		if (!err && resp !== null) {
			if (resp.status === 'p') {
				if (resp.server === server) {
					resp.session_id = user.session_id;
					self.emit('leave-room', resp);
					self.emit('part', resp);
				} else {
					self.client.sadd(self.alive, user.session_id);
				}
			} else {
				self.client.del(user.session_id);
			}
		}
	});
};


module.exports = Spy;