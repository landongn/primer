App.KeyShortcutMixin = Ember.Mixin.create({
	gameActions: {},

	activate: function () {
		this._super();
		for (var key in this.get('gameActions')) {
			Mousetrap.bind(key, this.get('gameActions')[key]);
		}
	},

	deactivate: function () {
		this._super();
		for (var key in this.get('gameActions')) {
			Mousetrap.unbind(key, this.get('gameActions')[key]);
		}
	}
});