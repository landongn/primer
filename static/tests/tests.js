require('lib/qunit/qunit/qunit.js');
require('./helpers');

App.setupForTesting();
App.injectTestHelpers();

require('./controllers/*');
require('./components/*');
require('./mixins/*');
require('./models/*');
require('./routes/*');
require('./views/*');

function setFavicon(uri) {
	$("link").each(function () {
		var el = $(this);
		if (/\bicon\b/i.test(el.attr("rel"))) {
			el.remove();
		}
	});

	$('<link>').attr({ type: "image/x-icon", rel: "icon", href: uri }).appendTo($('head'));
}

QUnit.done(function (results) {
	if (results.failed) {
		setFavicon('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2P8z8AAROQDxlEDGEbDgGE0DIBZaBikAwCl1B/x0/RuTAAAAABJRU5ErkJggg==');
		document.title = results.failed + ' of ' + results.total + ' failed.';
	} else {
		setFavicon('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2Nk+A+EFADGUQMYRsOAYTQMgHloGKQDAJXkH/HZpKBrAAAAAElFTkSuQmCC');
		document.title = 'All ' + results.total + ' passed.';
	}
});
