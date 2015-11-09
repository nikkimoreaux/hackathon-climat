module.exports = function(grunt) {

	var default_tasks = ['copy','jshint','uglify','concat','less'];

	var js_to_uglify = ['src/index.js'];
	
	grunt.initConfig({
		
		jshint: {
			files: js_to_uglify,
			options: {
				newcap: false,
				globalstrict: true,
				undef: true,
				browser: true,
				globals: {
					window: true,
					document: true,
					console: true,
					_: true,
					angular: true,
					ecodistricts: true,
					mapboxgl: true,
					tinycolor: true
				}
			}
		},
		
		
		concat: {
			dist: {
				files: {
					'dist/index.js': ['node_modules/underscore/underscore.js',
									'node_modules/angular/angular.js',
									'node_modules/tinycolor2/tinycolor.js',
									'bower_components/angularjs-geolocation/dist/angularjs-geolocation.min.js',
									'tmp/index.js'
					]
				}
			}
		},
		
		uglify: {
			dist: {
				options: {
					screwIE8: true
				},
				files: {
					'tmp/index.js': js_to_uglify
				}
			}
		},
		
		less: {
			dist: {
				options: {
					compress: true
				},
				files: {
					'dist/index.css': 'src/index.less'
				}
			}
		},
	
		copy: {
			dist: {
				expand : true,
				cwd: 'src',
				dest: 'dist',
				src: ['index.html','**/.htaccess']
			}
		},
	
		watch: {
			dist: {
				files: ['src/**/*','config/**/*','../big/build/big-angular.min.js'],
				tasks: default_tasks,
				options: {
					livereload: true
				}
			}
		}
	});
	

	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	

	grunt.registerTask('default', default_tasks);

};