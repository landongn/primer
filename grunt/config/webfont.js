/*jshint node:true*/
'use strict';

// https://github.com/sapegin/grunt-webfont

// Generate custom icon webfont from svgs.

// Dependancies need to be installed before running.

// brew install fontforge ttfautohint

module.exports = function (config) {
	return {
		icons: {
			src: config.source + 'icons/*.{svg,eps}',
			dest: config.source + 'fonts',
			destCss: config.source +  'scss/fonts',
			options: {
				hashes: false,
				syntax: 'bootstrap',
				relativeFontPath: '../fonts/',
				stylesheet: 'scss',
				font: 'icons'
			}
		}
	};
};
