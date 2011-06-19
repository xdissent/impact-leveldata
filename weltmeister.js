ig.module(
	'plugins.impact-leveldata.weltmeister'
)
.requires(
    'weltmeister.weltmeister'
)
.defines(function() {

wm.Weltmeister.inject({
    _dataHooks: [],
    
    _levelData: {},
    
    init: function() {
        
        // Load Weltmeister plugin CSS
        $('<link />', {
            rel: 'stylesheet',
            type: 'text/css',
            href: wm.config.project.modulePath + 'plugins/impact-leveldata/weltmeister.css'
        }).appendTo('head');
        
		// Create Level Data Container
        $('<div id="levelDataContainer"> \
			<h2>Level Settings</h2> \
			<div id="levelDataProperties"></div> \
			<dl id="levelDataPropertyInput"> \
				<dt>Key:</dt><dd><input type="text" class="text" id="levelDataKey"/></dd> \
				<dt>Value:</dt><dd><input type="text" class="text" id="levelDataValue"/></dd> \
			</dl> \
		</div>').insertBefore('#layerContainer');
		
		$('#levelDataKey').bind( 'keydown', function(ev){ 
			if( ev.which == 13 ){ 
				$('#levelDataValue').focus(); 
				return false;
			}
			return true;
		});
		$('#levelDataValue').bind( 'keydown', this.setLevelData.bind(this) );
        
        this.parent();
    },
    
    loadNew: function() { 
        this._levelData = {};
        this.loadLevelData();
        this.parent();
    },
    
	loadResponse: function( data ) {

		// extract JSON from a module's JS
		var jsonMatch = data.match( /\/\*JSON\[\*\/([\s\S]*?)\/\*\]JSON\*\// );
		var parsedData = $.parseJSON( jsonMatch ? jsonMatch[1] : data );

        this._levelData = parsedData.data ? parsedData.data : {};
		this.loadLevelData();
		
		return this.parent(data);
    },
	
	loadLevelData: function() {
		var html = '';
		html += this.loadLevelDataRecursive(this._levelData);
		$('#levelDataProperties').html(html);
		$('.levelDataProperty').bind('mouseup', this.selectLevelData);
	},
	

	loadLevelDataRecursive: function( settings, path ) {
		path = path || "";
		var html = "";
		for( key in settings ) {
			var value = settings[key];
			if( typeof(value) == 'object' ) {
				html += this.loadLevelDataRecursive( value, path + key + "." );
			}
			else {
				html += '<div class="levelDataProperty"><span class="key">'+path+key+'</span>:<span class="value">'+value+'</span></div>';
			}
		}
		
		return html;
	},
	
	
	setLevelData: function( ev ) {
		if( ev.which != 13 ) {
			return true;
		}
		var key = $('#levelDataKey').val();
		var value = $('#levelDataValue').val();
		var floatVal = parseFloat(value);
		if( value == floatVal ) {
			value = floatVal;
		}
		
		this.writeSettingAtPath( this._levelData, key, value );
		
		ig.game.setModified();
		ig.game.draw();
		
		$('#levelDataKey').val('');
		$('#levelDataValue').val('');
		$('#levelDataValue').blur();
		this.loadLevelData();
		
		$('#levelDataKey').focus(); 
		return false;
	},
	
	
	writeSettingAtPath: function( root, path, value ) {
		path = path.split('.');
		var cur = root;
		for( var i = 0; i < path.length; i++ ) {
			var n = path[i];
			if( i < path.length-1 && typeof(cur[n]) != 'object' ) {
				cur[n] = {};
			}
			
			if( i == path.length-1 ) {
				cur[n] = value;
			}
			cur = cur[n];		
		}
		
		this.trimObject( root );
	},
	
	
	trimObject: function( obj ) {
		var isEmpty = true;
		for( var i in obj ) {
			if(
			   (obj[i] === "") ||
			   (typeof(obj[i]) == 'object' && this.trimObject(obj[i]))
			) {
				delete obj[i];
			}
			
			if( typeof(obj[i]) != 'undefined' ) {
				isEmpty = false;
			}
		}
		
		return isEmpty;
	},
	
	
	selectLevelData: function( ev ) {
		$('#levelDataKey').val( $(this).children('.key').text() );
		$('#levelDataValue').val( $(this).children('.value').text() );
		$('#levelDataValue').select();
	},
    
    registerDataHook: function(hook) {
        if (typeof hook == 'function') {
            this._dataHooks.push(hook);
        }
    },
    
	save: function( dialog, path ) {
		this.filePath = path;
		this.fileName = path.replace(/^.*\//,'');
		var data = {
			'entities': this.entities.getSaveData(),
			'layer': [],
			'data': this._levelData
		};
		
		var resources = [];
		for( var i=0; i < this.layers.length; i++ ) {
			var layer = this.layers[i];
			data.layer.push( layer.getSaveData() );
			if( layer.name != 'collision' ) {
				resources.push( layer.tiles.path );
			}
		}
		
		for (var i = 0; i < this._dataHooks.length; i++) {
		    data = this._dataHooks[i](data);
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