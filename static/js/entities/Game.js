App.Game = Ember.Object.extend({
	name: 'Primer',

	init: function () {

		this.stats = new Stats();
		this.stats.setMode(0); // 0: fps, 1: ms

		// Align top-left
		this.stats.domElement.style.position = 'absolute';
		this.stats.domElement.style.right = '0px';
		this.stats.domElement.style.top = '0px';

		document.body.appendChild(this.stats.domElement);


		this.engine = new Phaser.Game(
			window.innerWidth,
			window.innerHeight,
			Phaser.AUTO,
			'into'
		);

		


	}
}).create();


