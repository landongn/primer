/*jslint node: true */
//######################
//## TWAAAAAINZZ~~~
//######################

var Emitter = require('events').EventEmitter;
var config = require('../../conf')();
var util = require('util');
var GRID = 100;
function Bot(spy) {
	var start = [5150];
//	var start = [2513,1443,2273,4812,4991,8327,8578];
	this.channel = null;
	this.delta = new Date().getTime() / 1000;
	this.spy = spy;
	this.username = null;
	this.tiles = 0;
	this.parts = [];
	this.lastSelection = start[Math.floor(Math.random() * start.length)];
	return this;
}


util.inherits(Bot, Emitter);

Bot.prototype.allowedCol = function (spot) {
	return Math.floor(spot / GRID) === Math.floor(this.lastSelection / GRID) && (this.parts.indexOf(spot) === -1);
};

Bot.prototype.allowedRow = function (spot) {
	return ((spot - GRID) > -1) && ((spot + GRID) < GRID * GRID) && (this.parts.indexOf(spot) === -1);
};

Bot.prototype.selectCell = function () {

	var touch;
	var self = this;

	var options = [ ];
	if (this.allowedCol(this.lastSelection - 1)) {
		options.push(this.lastSelection - 1);
	}
	if (this.allowedCol(this.lastSelection + 1)) {
		options.push(this.lastSelection + 1);
	}
	if (this.allowedRow(this.lastSelection + GRID)) {
		options.push(this.lastSelection + GRID);
	}
	if (this.allowedRow(this.lastSelection - GRID)) {
		options.push(this.lastSelection - GRID);
	}

	if (options.length === 0) {
		// Fill up the bot so it dies
		// Can't call destroy or a new one
		// won't spawn
		for (var i = 0; i < 100; i++) {
			self.parts.push(i);
		}
		return;
	}
	touch = options[Math.floor(Math.random() * options.length)];

	if (typeof this.parts !== 'object') {
		this.parts = [];
	}

	this.lastSelection = touch;

	this.spy.engine.client.sismember(this.channel, touch, function (err, resp) {

		if (!err && resp === 0) {
			self.spy.engine.client.sadd(self.channel + '_parts', touch, function (err, resp) {
				if (resp === 0) {
					return;
				} else {
					self.spy.engine.client.sadd(self.username + '_parts', touch);
					self.parts.push(touch);
					self.tiles++;
					self.spy.engine.broadcast({
						messageType: 'add_track',
						session_id: self.username,
						channel: self.channel,
						index: touch
					});
				}
			});
		} else {
			self.selectCell();
		}
	});
};


Bot.prototype.spawn = function (username, channel) {

	var self = this;
	if (!channel || !username) {
		return;
	}

	this.username = username;
	this.channel = channel;
	this.brain = null;
	this.data = {};
	this.parts = [];
	this.spy.engine.client.smembers(self.username + '_parts', function (err, resp) {
		if (!err && resp !== null) {
			self.parts = resp;
		}
	});

	this.brain = setInterval(function () {
		self.update();
	}, 5000);

	this.spy.emit('bot-join', this);

	return this;
};

Bot.prototype.update = function () {
	this.selectCell();
};

Bot.prototype.destroy = function () {
	this.spy.emit('bot-cleanup', this);
	clearInterval(this.brain);
};


module.exports = Bot;