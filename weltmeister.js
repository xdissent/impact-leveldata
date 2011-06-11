ig.module(
	'plugins.leveldata.weltmeister'
)
.requires(
    'weltmeister.weltmeister'
)
.defines(function() {

wm.Weltmeister.inject({
    _data_hooks: [],
    registerDataHook: function(hook) {
        if (typeof hook == 'function') {
            this._data_hooks.push(hook);
        }
    },
	save: function( dialog, path ) {
		this.filePath = path;
		this.fileName = path.replace(/^.*\//,'');
		var data = {
			'entities': this.entities.getSaveData(),
			'layer': []
		};
		
		var resources = [];
		for( var i=0; i < this.layers.length; i++ ) {
			var layer = this.layers[i];
			data.layer.push( layer.getSaveData() );
			if( layer.name != 'collision' ) {
				resources.push( layer.tiles.path );
			}
		}
		
		for (var i = 0; i < this._data_hooks.length; i++) {
		    data = this._data_hooks[i](data);
		}
		
		var dataString = $.toJSON(data);
		if( wm.config.project.prettyPrint ) {
			dataString = JSONFormat( dataString );
		}
		
		// Make it a ig.module instead of plain JSON?
		if( wm.config.project.outputFormat == 'module' ) {
			var levelModule = path
				.replace(wm.config.project.modulePath, '')
				.replace(/\.js$/, '')
				.replace(/\//g, '.');
				
			var levelName = levelModule.replace(/^.*\.(\w)(\w*)$/, function( m, a, b ) {
				return a.toUpperCase() + b;
			});
			
			
			var resourcesString = '';
			if( resources.length ) {
				resourcesString = "Level" + levelName + "Resources=[new ig.Image('" +
					resources.join("'), new ig.Image('") +
				"')];\n";
			}
			
			// include /*JSON[*/ ... /*]JSON*/ markers, so we can easily load
			// this level as JSON again
			dataString =
				"ig.module( '"+levelModule+"' )\n" +
				".requires('impact.image')\n" +
				".defines(function(){\n"+
					"Level" + levelName + "=" +
						"/*JSON[*/" + dataString + "/*]JSON*/" +
					";\n" +
					resourcesString +
				"});";
		}
		
		var postString = 
			'path=' + encodeURIComponent( path ) +
			'&data=' + encodeURIComponent(dataString);
		
		var req = $.ajax({
			url: wm.config.api.save,
			type: 'POST',
			dataType: 'json',
			async: false,
			data: postString,
			success:this.saveResponse.bind(this)
		});
	}
});

});