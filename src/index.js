'use strict';

mapboxgl.accessToken = 'pk.eyJ1IjoiZGlwbG9kb2N1cyIsImEiOiJVS3Awd0VjIn0.h-4kf2_aTY_dGxyImqy2DA';

var ecodistrict = angular.module('ecodistrict',['geolocation']);

ecodistrict.controller('mapCtrl',['$scope','$http','$sce','geolocation','$timeout',function($scope, $http, $sce, geolocation,$timeout){
	
	var json_endpoint = './api';
	var start_view = {
		'center': [6.191492,48.678574],
		'zoom': 10.8,
		'pitch': 0
	};
	
	$scope.display_modes = [];
	$scope.current_display_mode = false;
	$scope.show_pois = false;
	
	var jsonp_loaded = false;
	var map_loaded = false;
	var inited = false;
	
	var districts_shapes = [];
	var pois = [];
	
	
	// Create map
	var map = new mapboxgl.Map({
		container: 'map-container',
		style: 'mapbox://styles/mapbox/light-v8',
		center: start_view.center,
		zoom: start_view.zoom,
		pitch: start_view.pitch
	});
	map.dragRotate.disable();
	//map.addControl(new mapboxgl.Navigation());
	
	var ease_duration = 5000;
	$scope.status = 'start';
	$scope.getLocation = function(){
		geolocation.getLocation({
  			enableHighAccuracy: true,
  			timeout: 10000,
  			maximumAge: 3600000*20
		}).then(function(data){
		});
		$timeout(function(){
			$scope.status = 'located';
			map.easeTo({
				zoom:17,
				center:[6.200071,48.693726],
				duration: ease_duration,
				pitch: 50
			});
		},1000);
		$scope.status = 'locating';
	};
	$scope.quitLocation = function(){
		map.easeTo({
			center: start_view.center,
			zoom: 11.5,
			pitch: start_view.pitch,
			duration: ease_duration
		});
		$scope.status = 'start';
	};
	
	
	
	
	// Load JSON
	var loadJson = function(){

		$http({
			method: 'GET',
			url: json_endpoint
		})
		.success(function(data, status){
			
			jsonp_loaded = true;
			
			$scope.display_modes = data.display_modes;
			$scope.current_display_mode = data.display_modes[0];
			
			pois = data.pois;
			districts_shapes = data.districts_shapes;
			
			tryInit();
		})
		.error(function(data,status){
		});
		
	};
	loadJson();
	
	
	
	
	// --------- DisplayMode ----------
	
	var showDisplayMode_sources_to_remove = [];
	var showDisplayMode = function(display_mode,need_apply){
		
		_.each(showDisplayMode_sources_to_remove,function(src){
			map.removeSource(src);
			map.removeLayer(src);
		});
		showDisplayMode_sources_to_remove = [];
		
		
		// Split in 20 colors
		var num_of_colors = 20;

		var color_min = display_mode.districts_values_min_color?
		tinycolor(display_mode.districts_values_min_color):
		tinycolor({r:255,g:255,b:255,a:0});
		var color_max = display_mode.districts_values_max_color?
		tinycolor(display_mode.districts_values_max_color):
		tinycolor({r:255,g:255,b:255,a:0});
		
		$scope.color_min = color_min.toRgbString();
		$scope.color_max = color_max.toRgbString();
		
		var colors = [];
		for (var c = 0; c < num_of_colors; c++){
			colors.push(tinycolor.mix(color_min,color_max,(c/(num_of_colors-1))*100));
		}
		
		var dvs = _.pluck(display_mode.districts_values,'value');
		var min = _.min(dvs),max = _.max(dvs);
		
		
		// Attribute alpha to districts_values if empty
		_.each(display_mode.districts_values,function(district_value){
			if(!_.isNumber(district_value.alpha)){
				district_value.alpha = (district_value.value-min)/(max-min);
			}
		});
		
		
		if(display_mode.chiant){
			display_mode.districts_values = _.sortBy(display_mode.districts_values,'alpha');
			_.each(display_mode.districts_values,function(district_value,i){
				district_value.alpha = i/(display_mode.districts_values.length-1);
			});
		}
		
		_.each(display_mode.districts_values,function(district_value){
			district_value.color_num = Math.round(district_value.alpha*(num_of_colors-1));
		});
		
		
		
		// Sort by alpha
		var districts_groups = _.groupBy(_.sortBy(display_mode.districts_values,'color_num'),'color_num');
		
		
		_.each(districts_groups,function(districts_group){
			
			var color_num = districts_group[0].color_num;
			
			var districts_group_source = new mapboxgl.GeoJSONSource({
				'type': 'geojson',
				'data': {
					"type": "FeatureCollection",
					"features": _.map(districts_group,function(district){
						return {
							type: 'Feature',
							properties: {
								"id": district.id,
								"infobubble": district.infobubble
							},
							geometry: _.findWhere(districts_shapes,{id:district.id}).geometry
						};
					})
				}
			});
			
			map.addSource("districts_group_"+color_num,districts_group_source);
			map.addLayer({
				"id": "districts_group_"+color_num,
				"type": "fill",
				"source": "districts_group_"+color_num,
				"interactive": true,
				"paint": {
					"fill-outline-color": "#FFFFFF",
					"fill-color": colors[color_num].toHexString(),
					"fill-opacity": colors[color_num].getAlpha()
				}
			});
			
			showDisplayMode_sources_to_remove.push("districts_group_"+color_num);
		});
	};
	
	
	
	
	// --------- POIs ----------
	
	$scope.pois_types = [
		["Chauffage","#e74c3c"],
		["Isolation","#3498db"]
	];

	var showPOIs_sources_to_remove = [];
	var showPOIs = function(){
		// POIs
		var pois_groups = _.groupBy(pois,function(poi){
			return 'type'+poi.type+(poi.big?'big':'small');
		});
		pois_groups = _.sortBy(pois_groups,function(pois_group){
			return (pois_group[0].big?1000:1)+pois_group[0].type;
		});
		
		hidePOIs();
		
		_.each(pois_groups,function(pois_group,id){
			
			var source_id = "pois"+id;
			var poi = pois_group[0];
			
			var pois_source = new mapboxgl.GeoJSONSource({
				'type': 'geojson',
				'data': {
					"type": "FeatureCollection",
					"features": _.map(pois_group,function(poi){
						return {
							type: 'Feature',
							properties: {
								infobubble: poi.infobubble
							},
							geometry: {
								type: 'Point',
								coordinates: [poi.lon,poi.lat]
							}
						};
					})
				}
			});
			map.addSource(source_id,pois_source);
			

			var color = $scope.pois_types[poi.type][1];
			
			if(!color){
				color = $scope.pois_types[0][1];
			}
			
			var border = 3;
			var radius_small = 10;
			var radius_big = 25;
			
			map.addLayer({
				"id": source_id,
				"type": "circle",
				"interactive": true,
				"infobubble": poi.infobubble,
				"source": source_id,
				"paint": {
					"circle-radius": poi.big?radius_big:radius_small,
					"circle-color": "#ffffff"
				}
			});
			map.addLayer({
				"id": "over"+source_id,
				"type": "circle",
				"source": source_id,
				"paint": {
					"circle-radius": (poi.big?radius_big:radius_small)-border,
					"circle-color": color
				}
			});
			
			showPOIs_sources_to_remove.push(source_id);
		});
		
	};
	var hidePOIs = function(){
		
		_.each(showPOIs_sources_to_remove,function(src){
			map.removeSource(src);
			map.removeLayer(src);
			map.removeLayer("over"+src);
		});
		showPOIs_sources_to_remove = [];
		
	};
	
	
	
	
	
	// Infobubble
	$scope.infobubble = false;
	map.on('click',function(e){
		map.featuresAt(e.point, {radius: 15}, function (err, features) {			
			var feature = false;
			if(features.length){
				feature = features[features.length-1];
				console.log(feature);
				
				if(feature.properties && feature.properties.infobubble){
					$scope.infobubble = $sce.trustAsHtml(feature.properties.infobubble);
					$scope.$apply();
				}
			}
			
		});
	});
	$scope.closeInfobubble = function(){

		$scope.infobubble = false;
	};
	
	
	
	
	// init
	var tryInit = function(){
		if(map_loaded && jsonp_loaded){
			
			showDisplayMode($scope.current_display_mode);
			
			if($scope.show_pois){
				showPOIs();
			}else{
				hidePOIs();
			}
			
			inited = true;
		}
	};
	
	
	// Watch current_display_mode and map load
	$scope.$watch('current_display_mode',function(new_current_display_mode){
		if(inited){
			showDisplayMode(new_current_display_mode);
			if($scope.show_pois){
				showPOIs();
			}else{
				hidePOIs();
			}
		}
	});
	$scope.$watch('show_pois',function(nv){
		if(inited){
			if(nv){
				showPOIs();
			}else{
				hidePOIs();
			}
		}
	});
	map.on('load',function(e){
		map_loaded = true;
		tryInit();
		$scope.$apply();
	});
	
}]);