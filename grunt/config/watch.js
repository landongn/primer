/*jshint node:true*/
'use strict';

// https://github.com/gruntjs/grunt-contrib-watch

// Run tasks whenever files are changed, added, or deleted.

module.exports = function (config) {
	return {
		compass: {
			files: [config.source + 'scss/{,**/}{,*.scss,*.sass}'],
			tasks: ['sass:develop', 'autoprefixer:develop', 'newer:copy:develop']
		},
		emberTemplates: {
			files: config.source + 'templates/{,**/}{,*.hbs}',
			tasks: ['emberTemplates']
		},
		haychtml: {
			files: [config.pages + '{,**/}*.html'],
			tasks: ['haychtml:develop']
		},
		neuter: {
			files: [config.source + 'js/{,**/}{,*.js}'],
			tasks: ['neuter:app']
		},
		neuterLibs: {
			files: [config.source + 'js/libs.js'],
			tasks: ['neuter:libsDevelop']
		},
		neuterTests: {
			files: [config.source + 'tests/{,**/}{,*.js}'],
			tasks: ['neuter:tests']
		},
		copy : {
			files: '<%= copy.build.src %>',
			tasks: ['newer:copy:build']
		},
		livereload: {
			options: {
				debounceDelay: 250,
				livereload: 38000
			},
			files: config.deploy + '**/*.{html,css,js,png,jpg,jpeg,gif,webp,svg}'
		}
	};
};
