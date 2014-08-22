/*jshint node:true*/
'use strict';

// https://github.com/gruntjs/grunt-contrib-copy

// Copy files and folders.

module.exports = function (config) {
	return {
		build: {
			expand: true,
			src: [
				config.source + '*.{ico,txt}',
				config.source + '.htaccess',
				config.source + 'img/{,*/}*.{jpg,jpeg,png,webp,gif}',
				config.source + 'fonts/*',
				config.source + 'lib/modernizr/modernizr.js'
			],
			dest: config.deploy
		},
		develop: {
			expand: true,
			src: [config.source + 'scss/**/*.scss'],
			dest: config.deploy
		}
	};
};
