
//######################
//## flood the shit out of the lionel socket server.
//######################

var config = {
	numConnections: 2,
	activityRange: [1000, 1000],
};

var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;

function Test() {
	var chars = 'abcdefghijklmnopqrstuvwxyz1234567890!@#$%^&*()_+=ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split("");

	var self = this;
	var username = chars[Math.floor(Math.random(chars.length * chars.length) * chars.length)];
	for (var i = 0; i < 20; i++) {
		username += chars[Math.floor(Math.random(chars.length * chars.length) * chars.length)];
	}

	var b = require('socket.io-client');
	var socket = b.connect('http://localhost:8010', {'force new connection': true});
	socket.on('connect', function () {});
	var channel;
	var session_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});

	if (!username && !session_id) {
		return;
	}

	setInterval(function () {
        if (channel) {
    		var touch = Math.floor(Math.random() * 400);
	    	socket.emit('add_track', {index: touch, session_id: session_id, username: username, channel: channel});
            //console.log(session_id+channel+touch);
        }
	}, Math.floor(Math.random() * (config.activityRange[1] - (config.activityRange[1]) + 1)) + config.activityRange[1]);
	//######################
	//## server will respond to a new connection with the 'ident' message
	//######################

	//identify yourself to the server once it asks you for details
	socket.on('ident', function () {
		console.log('ident received');

		socket.emit('ident', {
			username: username,
			session_id: session_id
		});
		console.log('ident sent');
	});

	//######################
	//## then, the server will respond to a 'list' event, telling you the room to join.
	//######################

	socket.on('channel_roster', function (data) {
		//console.log("data for rooms: ", data);
	});

	//######################
	//## assigns the user to a room
	//######################

	socket.on('assigned_to_channel', function (data) {
		//console.log('assigned to channel: ', data.channel);
	});

	//######################
	//## allows the user to place track once is set.
	//######################
	socket.on('became_player', function (data) {
		console.log('promoted to player, seat id: ', data.channel);
        channel = data.channel;
	});

	socket.on('became_spectator', function (data) {
		//console.log('spec, seat id: ', data.channel);
		socket.emit('request_seat');
	});

	//######################
	//## pushes a list of clients and their parts
	//######################

	socket.on('channel_roster', function (data) {
		//console.log('delta update', data);
	});

	//######################
	//## someone has added some track
	//######################

	socket.on('add_track', function (data) {
		//console.log("added track: ", data);
	});

	//######################
	//## someone has removed some track
	//######################

	socket.on('remove_track', function (data) {
		//console.log("removed track: ", data);
	});


	//######################
	//## someone has joined the channel
	//######################

	socket.on('join', function (data) {
		//console.log("joined", data);
	});


	//######################
	//## someone has left the channel.  do some clean up
	//######################

	socket.on('part', function (data) {

	});

	//######################
	//## the user has a duplicate username. try something else.
	//######################

	socket.on('bad_username', function () {
		socket.disconnect();
        process.exit(1);
	});

	//######################
	//## the socket has been disconnected (latency, downtime, unreachable, etc)
	//######################

	socket.on('disconnect', function () {
        process.exit(1);
	});

	socket.on('not_allowed', function () {
        process.exit(1);
	});

	//######################
	//## the master server has no rooms (is an error that SHOULD never happen)
	//######################
	socket.on('master_socket_empty', function () {
        process.exit(1);
	});

	setTimeout(function (){
		socket.disconnect();
	}, (1000*60*60*1.5));

}
var a = new Test();
if (cluster.isMaster) {
	// Fork workers.
	for (var i = 0; i < 100; i++) {
		cluster.fork();
	}
} else {
	var a = new Test();
}